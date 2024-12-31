import json
import os
from pathlib import Path
from threading import Lock
from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel
from ..agent.event.base import ExecutionState, Event

class Task(BaseModel):
    """Task model"""
    id: str
    intent: str
    args: Optional[Dict[str, Any]] = None
    steps: List[Event] = [] 
    created_at: datetime
    updated_at: datetime

class TaskManager:
    """
    A singleton class to manage tasks.
    Only one task can be running at a time.
    """
    _instance = None

    def __new__(cls, tasks_dir: Path):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialize(tasks_dir)
        return cls._instance

    def _initialize(self, tasks_dir: Path):
        """
        Initialize the singleton instance only once

        Args:
            tasks_dir: The directory to store task execution event files
        """
        self.tasks_dir = tasks_dir
        self.current_task: Optional[Task] = None
        os.makedirs(tasks_dir, exist_ok=True)
        self._task_lock = Lock()  # Instance lock for task operations

    def create_task(self, id: str, intent: str, args: Optional[Dict[str, Any]] = None) -> Task:
        # id and intent are mandatory
        if not id or not id.strip() or not intent or not intent.strip():
            raise ValueError("Task id and intent cannot be empty")
        
        with self._task_lock:
            if self.current_task:
                raise ValueError("Another task is currently running, please wait for it to complete.")
            
            task = Task(
                id=id,
                intent=intent.strip(),
                args=args or {},
                created_at=datetime.now(),
                updated_at=datetime.now(),
                steps=[]
            )
            
            self.current_task = task
            return task

    def close_task(self):
        if self.current_task:
            self._save_task(self.current_task)
            self.current_task = None

    def update_task_execution_state(self, event: Event) -> bool:
        if not self.current_task or self.current_task.id != event.data.task_id:
            raise ValueError(f"Task {event.data.task_id} not found")

        # Add event to task steps
        self.current_task.steps.append(event)
        self.current_task.updated_at = datetime.now()

        # If the event indicates task completion, save and clear current task
        if event.state in [ExecutionState.TASK_OK, ExecutionState.TASK_FAIL, ExecutionState.TASK_CANCEL]:
            self.close_task()

        return True

    def _save_task(self, task: Task):
        """
        Save the task to a json file.
        """
        filename = f"{task.id}.json"
        filepath = os.path.join(self.tasks_dir, filename)
        
        with open(filepath, 'w') as f:
            json.dump(task.model_dump(), f, indent=2, default=str) 