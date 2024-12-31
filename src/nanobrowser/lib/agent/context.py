"""
Common used types across the sub-packages of the agent package
"""
from dataclasses import dataclass
from typing import Optional
from .event.manager import EventManager
from ..browser.context import BrowserContext
from ..utils.path_manager import PathManager

# default values for agent context
DEFAULT_MAX_STEPS = 50
DEFAULT_MAX_ERRORS = 20
DEFAULT_MAX_TOOL_ROUNDS = 20

@dataclass
class AgentContext():
    """
    Context for agent, used to provide the agent with the necessary information to perform its tasks.

    Example:
    
     - It will be injected into tool actions so that they can interact with the browser, file system, etc.
     - It will be used to provide LLMs with the current task id, step, round, error count, max steps, max tool rounds, etc.
    """
    # path manager
    path_manager: PathManager
    # browser context
    browser_context: BrowserContext
    # event manager
    event_manager: EventManager
    # current task id
    task_id: Optional[str] = None
    # current step in task execution
    step: int = 0
    # current round of tool calls in step execution
    tool_round: int = 0
    # current error count
    error: int = 0
    # max steps allowed in task execution
    max_steps: int = DEFAULT_MAX_STEPS
    # max rounds of tool calls allowed in one step
    max_tool_rounds: int = DEFAULT_MAX_TOOL_ROUNDS
    # max errors allowed
    max_errors: int = DEFAULT_MAX_ERRORS


class Actors:
    """Actors in the agent system"""
    MANAGER = "manager"     # Manager is a virtual actor that represents the agent service
    PLANNER = "planner"     # Planner is the agent that plans the task
    NAVIGATOR = "navigator" # Navigator is the agent that navigates the browser
    EVALUATOR = "evaluator" # Evaluator is the agent that evaluates the step result
    VALIDATOR = "validator" # Validator is the agent that validates the final result
    USER = "user"           # User is the actor that interacts with the agent

