from dataclasses import dataclass
from typing import Optional, Union
from pathlib import Path
from asyncio import Lock
import logging
from pydantic import BaseModel
from langchain_core.language_models.chat_models import BaseChatModel
from .agents.planner import PlannerAgent, PlannerResult
from .agents.navigator import NavigatorAgent, NavigatorResult
from .agents.base import BaseAgentOptions
from ..browser.manager import PlaywrightManager, PlaywrightOptions
from .context import AgentContext, Actors
from .event import EventManager, EventType, Event, TaskEventLogger, ExecutionState, EventData, EventCallback
from ..utils.path_manager import PathManager

logger = logging.getLogger(__name__)

@dataclass
class StepState:
    steps: int
    input: str
    output: Union[str, BaseModel, None] = None
    error: Union[str, None] = None
    terminated: bool = False

class Executor:
    _instance = None
    _lock = Lock()
    
    def __new__(cls, *args, **kwargs):
        if not cls._instance:
            cls._instance = super(Executor, cls).__new__(cls)
        return cls._instance

    def __init__(self, 
                 base_dir: Path,
                 llmPlanner:BaseChatModel, 
                 llmNavigator:BaseChatModel, 
                 save_chat_history: bool=True,
                 chrome_app_path: Optional[Path]=None,
                 chrome_cdp_port: Optional[int]=9222,
                 log_events: Optional[bool]=True,
                 max_steps: Optional[int]=100,
                 max_errors: Optional[int]=20,
                 max_tool_rounds: Optional[int]=20,
                 ):
        # Only initialize if not already initialized
        if not hasattr(self, '_initialized'):
            self._path_manager = PathManager(base_dir)
            self._save_chat_history = save_chat_history
            self._planner_options = BaseAgentOptions(id=Actors.PLANNER, chatLLM=llmPlanner)
            self._navigator_options = BaseAgentOptions(id=Actors.NAVIGATOR, chatLLM=llmNavigator)

            self._browser_context = None
            self._agent_context = None
            self._initialized = False
            self._current_task_id = None

            # setdefault values
            self._max_steps = max_steps
            self._max_errors = max_errors
            self._max_tool_rounds = max_tool_rounds

            # create browser manager but not initialize it
            playwright_options = PlaywrightOptions(
                chrome_app_path=chrome_app_path,
                cdp_port=chrome_cdp_port,
                screenshots_dir=self._path_manager.screenshots,
            )
            self._browser_manager = PlaywrightManager(playwright_options)

            # set up event manager
            self._event_manager = EventManager()
            if log_events:
                self._event_manager.subscribe(EventType.EXECUTION, TaskEventLogger.handle_event)

    async def initialize(self):
        # Use lock to prevent multiple simultaneous initializations
        async with self._lock:
            if self._initialized:
                return
            
            # initialize browser
            await self._browser_manager.async_initialize()
            self._browser_context = await self._browser_manager.get_browser_context()
            
            self._agent_context = AgentContext(
                browser_context=self._browser_context,
                event_manager=self._event_manager,
                path_manager=self._path_manager,
                max_steps=self._max_steps,
                max_errors=self._max_errors,
                max_tool_rounds=self._max_tool_rounds
            )
            
            # set up planner and navigator 
            self._planner_options.context = self._agent_context
            self._navigator_options.context = self._agent_context
            self._planner = PlannerAgent(self._planner_options)
            self._navigator = NavigatorAgent(self._navigator_options)

            self._initialized = True

    async def close(self):
        if self._browser_manager is not None:
            await self._browser_manager.close()
            self._browser_context = None
            self._browser_manager = None
            
    async def run(self, task: str, task_id: str, max_steps: Optional[int] = 100, tab_id: Optional[str] = None):
        """
        Run a task
        Args:
            task (str): The task to execute
            task_id (str): The ID of the task
            max_steps (int): The maximum number of steps to execute
            tab_id (str): The ID of the chrome tab to execute the task in. If not provided, a new tab will be opened. It's a hack to communicate with the chrome extension.
        """
        if not self._initialized:
            raise Exception("Executor is not initialized. Call initialize() before executing tasks.")
        
        # Check if there's already a task running
        async with self._lock:
            if self._current_task_id:
                error_message = f"Another task is currently running. Please wait for it to complete. Task ID: {self._current_task_id}"
                # emit task failed event
                await self._emit_event(ExecutionState.TASK_FAIL, EventData(
                        task_id=task_id,
                        step=0,
                        details=error_message
                ))
                raise Exception(error_message)
            
            # Initialize new task
            self._agent_context.task_id = task_id
            self._current_task_id = task_id
        
        try:
            # Start task execution in background
            await self._execute_task(task, max_steps, tab_id)
        finally:
            # Clear current task when done
            async with self._lock:
                self._current_task_id = None

    async def _execute_task(self, task: str, max_steps: int, tab_id: Optional[str]):
        """Internal method to handle task execution"""
        # reset agent context
        self._agent_context.step = 0
        self._agent_context.tool_round = 0
        self._agent_context.error = 0
        self._agent_context.max_steps = max_steps

        # reset planner and navigator agents
        self._planner.reset()
        self._navigator.reset()

        try:
            if tab_id:
                await self._browser_context.set_current_page(tab_id)

            # emit task started event
            await self._emit_event(ExecutionState.TASK_START, EventData(
                task_id=self._agent_context.task_id,
                step=self._agent_context.step,
                details=task
            ))

            # execute the task
            next_step = task
            while True:
                event_data = EventData(
                    task_id=self._agent_context.task_id,
                    step=self._agent_context.step,
                )
                # check if the task has reached the maximum number of steps
                if self._agent_context.step >= self._agent_context.max_steps:
                    event_data.details = f"Task failed with max steps reached: {self._agent_context.step}"
                    await self._emit_event(ExecutionState.TASK_FAIL, event_data)
                    break

                if self._agent_context.error >= self._agent_context.max_errors:
                    event_data.details = f"Task failed with max errors encountered: {self._agent_context.error}"
                    await self._emit_event(ExecutionState.TASK_FAIL, event_data)
                    break

                # Planner makes a plan and decides the next step to be executed by Navigator
                step_state = await self._plan(self._agent_context.step, next_step)
                if step_state.terminated:
                    event_data.details = step_state.output
                    event_data.final = True
                    await self._emit_event(ExecutionState.TASK_OK, event_data)
                    break
                elif step_state.error:
                    next_step = step_state.error
                    continue

                # Extract the next step from the PlannerResult
                next_step = step_state.output.next_step

                # Navigator executes the next step
                step_state = await self._navigate(self._agent_context.step, next_step)
                if step_state.error:
                    next_step = step_state.error
                else:
                    next_step = step_state.output
        except Exception as e:
            logger.error(f"Task failed with error: {e}")
            await self._emit_event(ExecutionState.TASK_FAIL, EventData(
                task_id=self._agent_context.task_id,
                step=self._agent_context.step,
                details=str(e)
            ))
        finally:
            # save chat history
            self._planner.save_chat_history()
            self._navigator.save_chat_history()

    async def _emit_event(self, state: ExecutionState, data: EventData):
        if self._agent_context:
            await self._agent_context.event_manager.emit(Event.create(
                state=state,
                actor=Actors.MANAGER,
                data=data
            ))

    async def _plan(self, steps: int, input_text: str)-> StepState:
        logger.debug(f"Step {steps+1}: planning - {input_text}")
        plan_response = await self._planner.process_request(input_text)
        if plan_response.result and isinstance(plan_response.result, PlannerResult):
            if plan_response.result.terminated:
                return StepState(steps=steps, input=input_text, output=plan_response.result.final_response, terminated=True)
            else:
                next_step = plan_response.result.next_step
                if next_step is None:
                    return StepState(steps=steps, input=input_text, error="Planner agent did not return a next step, terminating task")
                else:
                    return StepState(steps=steps, input=input_text, output=plan_response.result)
        else:
            return StepState(steps=steps, input=input_text, error=plan_response.error)
    
    async def _navigate(self, steps: int, task: str) -> StepState:
        logger.debug(f"Step {steps+1}: navigating - {task}")
        navigate_response = await self._navigator.process_request(task)
        if navigate_response.result and isinstance(navigate_response.result, NavigatorResult):
            # remove "##TERMINATE TASK##" from the response, if present, to avoid planner from terminating the task
            final_response = navigate_response.result.final_response
            return StepState(steps=steps, input=task, output=final_response)
        else:
            return StepState(steps=steps, input=task, error=navigate_response.error)
        
    async def subscribe_execution_state(self, callback: EventCallback):
        """Subscribe to execution state changes during task execution. In the callback, you can check the execution state and take appropriate actions."""
        self._event_manager.subscribe(EventType.EXECUTION, callback)