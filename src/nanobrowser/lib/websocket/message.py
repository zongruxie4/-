from pydantic import BaseModel
from enum import Enum
from typing import Optional, Dict, Any
from ..agent.event.base import Event, ExecutionState, EventData

"""
WebSocket message types
"""

class WebSocketMessageKind(Enum):
    """WebSocket message types:
    create: Create a new task
    cancel: Cancel a running task
    state: Task state update message
    hb: Application-level heartbeat
    ack: Heartbeat acknowledgment
    error: Error message
    get_task: Request the current running task ID
    current_task: Response with current task ID
    """
    HEARTBEAT = "hb"       # application heartbeat
    ACK = "ack"            # heartbeat acknowledgment
    CREATE = "create"      # create new task
    CANCEL = "cancel"      # cancel task
    TASK_STATE = "state"   # task state update
    ERROR = "error"        # error message
    GET_CURRENT_TASK = "get_task"  # Get the current running task
    CURRENT_TASK = "current_task"  # Response with current task

class WebSocketMessage(BaseModel):
    kind: WebSocketMessageKind
    data: Optional[Dict[str, Any]] = None 

class CreateTaskMessage(BaseModel):
    """Message to create a new task"""
    task_id: str
    intent: str
    args: Optional[Dict[str, Any]] = None

class CancelTaskMessage(BaseModel):
    """Message to cancel a running task"""
    task_id: str

class TaskStateMessage(BaseModel):
    """Message of task state update"""
    task_id: str
    state: ExecutionState
    actor: str
    data: EventData
    timestamp: str

    @classmethod
    def from_event(cls, event: Event) -> 'TaskStateMessage':
        return cls(
            task_id=event.data.task_id,
            state=event.state,
            actor=event.actor,
            data=event.data,
            timestamp=event.timestamp
        )

class ErrorMessage(BaseModel):
    """Message to indicate an error"""
    task_id: str
    message: str
    timestamp: str

class CurrentTaskMessage(BaseModel):
    """Message to respond with the current running task ID"""
    task_id: Optional[str]

