from pydantic import BaseModel
from enum import Enum
from typing import Optional, Callable, Coroutine
from ...utils.time_utils import get_current_timestamp_str

class EventType(Enum):
    """
    Type of events that can be subscribed to.

    For now, only execution events are supported.
    """
    EXECUTION = "execution"

class ExecutionState(Enum):
    """States representing different phases in the execution lifecycle.
    
    Format: <SCOPE>.<STATUS>
    Scopes: task, step, act
    Statuses: start, ok, fail, cancel
    
    Examples:
        TASK_OK = "task.ok"  # Task completed successfully
        STEP_FAIL = "step.fail"  # Step failed
        ACT_START = "act.start"  # Action started
    """
    # Task level states
    TASK_START = "task.start"
    TASK_OK = "task.ok"
    TASK_FAIL = "task.fail"
    TASK_CANCEL = "task.cancel"

    # Step level states
    STEP_START = "step.start"
    STEP_OK = "step.ok"
    STEP_FAIL = "step.fail"
    STEP_CANCEL = "step.cancel"

    # Action/Tool level states
    ACT_START = "act.start"
    ACT_OK = "act.ok"
    ACT_FAIL = "act.fail"

class EventData(BaseModel):
    """Data associated with an event"""
    task_id: str
    # step is the step number of the task where the event occurred
    step: int
    # tool_round is the round of the tool call used to execute the step
    tool_round: int = 0
    # details is the content of the event
    details: str = ""
    # final is True if the event is the final response from the actor
    final: Optional[bool] = None 
    # plan is present if planner made/revised a plan for the task at the step
    plan: Optional[str] = None
    # tool is the tool name used to execute the action step
    tool: Optional[str] = None


class Event(BaseModel):
    """
    Represents a state change event in the task execution system.
    Each event has a type, a specific state that changed,
    the actor that triggered the change, and associated data.
    """
    type: EventType
    state: ExecutionState
    actor: str
    data: EventData
    timestamp: str

    @classmethod
    def create(cls, state: ExecutionState, actor: str, data: EventData, 
               timestamp: str = None, type: EventType = EventType.EXECUTION) -> 'Event':
        ts_str = timestamp or get_current_timestamp_str()
        return cls(
            type=type,
            state=state,
            actor=actor,
            data=data,
            timestamp=ts_str
        )

# The type of callback for event subscribers
EventCallback = Callable[[Event], Coroutine]