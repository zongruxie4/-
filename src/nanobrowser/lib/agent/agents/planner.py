"""
Planner agent generates a navigation plan for the user's request
"""

import logging
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field
from langchain_core.messages import AIMessage
from .base import BaseAgentOptions, BaseAgent, AgentOutput
from ..prompts.planner import PlannerPrompt
from ..event.base import ExecutionState, EventData

logger = logging.getLogger(__name__)

class PlannerResult(BaseModel):
    """
    Result of the planner agent
    """
    terminated: bool = Field(
        description="Flag indicating whether the planner should terminate"
    )
    plan: Optional[str] = Field(
        default=None,
        description="Planned steps/actions to be executed"
    )
    next_step: Optional[str] = Field(
        default=None,
        description="The next immediate step/action to be executed"
    )
    final_response: Optional[str] = Field(
        default=None,
        description="The final response or conclusion after plan execution"
    )


class PlannerAgent(BaseAgent):
    def __init__(self, options: BaseAgentOptions):
        super().__init__(options)

        # make sure prompt is set
        if options.prompt is None:
            self.prompt = PlannerPrompt()
         

    async def process_request(
        self,
        user_input: str,
        additional_params: Optional[Dict[str, Any]] = None
    ) -> AgentOutput:

        self.context.step += 1
        self.context.tool_round = 0
        follow_up = self.context.step > 1

        # emit step started event
        await self.emit_event(ExecutionState.STEP_START, EventData(
            task_id=self.context.task_id,
            step=self.context.step,
            details=user_input
        ))
        
        try:
            # new task arrival, add system message
            if self.message_history.length() == 0:
                self.message_history.add_message(self.build_system_message())
            
            # get current page info
            page_info = await self.context.browser_context.get_current_page_info()
            user_message = self.build_user_message(user_input, url=page_info.url, title=page_info.title, follow_up=follow_up)
            logger.debug(f"Planner user message: {user_message}")

            self.message_history.add_message(user_message)

            retry = 0
            while retry < 3 and not self.context.stop_task_now:
                # sometimes LLM doesn't return the structured output, so we need to retry
                structured_llm = self.chatLLM.with_structured_output(PlannerResult, include_raw=True)
                response: dict[str, Any] = structured_llm.invoke(self.message_history.get_messages())
                
                result = response["parsed"]
                logger.debug(f"Planner result: {result} retry: {retry}")
                if result is not None:
                    break
                retry += 1

            if self.context.stop_task_now:
                return AgentOutput(
                    intent=user_input,
                    result=None,
                    error="Task cancelled"
                )

            result_str = result.model_dump_json(exclude_none=True)
            self.message_history.add_message(AIMessage(content=result_str))

            # emit event
            event_data = EventData(
                    task_id=self.context.task_id,
                    step=self.context.step,
                )
            
            if result.terminated:
                event_data.details = result.final_response
                event_data.final = True
            else:
                if result.plan is not None:
                    event_data.plan = result.plan

                # not terminated, but no next step provided
                if result.next_step is None:
                    self.context.error += 1
                    error_msg = "Only plan provided, but no next step provided"
                    
                    event_data.details = error_msg
                    await self.emit_event(ExecutionState.STEP_FAIL, event_data)

                    return AgentOutput(
                        intent=user_input,
                        result=None,
                        error=error_msg
                    )
                else:
                    event_data.details = result.next_step

            # emit event
            await self.emit_event(ExecutionState.STEP_OK, event_data)

            return AgentOutput(
                intent=user_input,
                result=result,
                error=None
            )
        except Exception as e:
            self.context.error += 1
            error_msg = str(e)
            # emit event
            await self.emit_event(ExecutionState.STEP_FAIL, EventData(
                task_id=self.context.task_id,
                step=self.context.step,
                details=error_msg
            ))

            # log detailed error
            logger.error(f"Error parsing planner response: {e}")
            return AgentOutput(
                intent=user_input,
                result=None,
                error=error_msg
            )
        



