"""
Base agent implementation that defines the core agent interface and common functionality.

This module provides the abstract base class that all other agents should inherit from,
along with common agent-related data structures and utilities.
"""
import json
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Dict, Optional, Any, List
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.tools import BaseTool
from pydantic import BaseModel
from ..memory import BaseChatHistory, InMemoryChatHistory
from ..prompts.base import BasePrompt
from ..context import AgentContext
from ..event.base import Event, EventData, ExecutionState

logger = logging.getLogger(__name__)

class AgentOutput(BaseModel):
    """Model representing the standardized output format for all agents"""
    intent: str | BaseModel
    tool_calls: Optional[List[Dict[str, Any]]] = None
    result: Optional[str | BaseModel] = None
    error: Optional[str] = None

@dataclass
class  BaseAgentOptions():
    """Basic configuration options for initializing an Agent"""
    # agent id
    id: str
    # Langchain chat model
    chatLLM: BaseChatModel 
    # agent context
    context: Optional[AgentContext] = None
    # prompt builder
    prompt: Optional[BasePrompt] = None
    # message history
    chat_history: Optional[BaseChatHistory] = None
    
class BaseAgent(ABC):
    """Base class for all agents"""
    def __init__(self, options: BaseAgentOptions):
        self.id = options.id
        self.chatLLM = options.chatLLM
        self.prompt = options.prompt if options.prompt else BasePrompt()
        self.context = options.context
        self.tools = {}
        # make sure message history is created
        if options.chat_history is None:
            self.message_history = InMemoryChatHistory()
        else:
            self.message_history = options.chat_history

    def register_tool(self, tool_func: BaseTool):
        logger.debug(f"Registering tool: {tool_func.name}")
        self.tools[tool_func.name] = tool_func

    def build_system_message(self) -> SystemMessage:
        prompt = self.prompt.get_system_prompt()
        return SystemMessage(content=prompt)
    
    def build_user_message(
        self,
        user_input: str,
        url: Optional[str] = None,
        title: Optional[str] = None,
        follow_up: Optional[bool] = False,
    ) -> HumanMessage:
        prompt = self.prompt.build_user_prompt(user_input, url=url, title=title, follow_up=follow_up)
        return HumanMessage(content=prompt)
    
    def reset(self):
        if self.message_history:
            self.message_history.clear()

   
    def save_chat_history(self):
        if self.message_history and self.context:
            messages = self.message_history.get_messages()
            # convert to json
            messages_json = [message.to_json() for message in messages]
            # save to file
            task_id = self.context.task_id
            file_path = self.context.path_manager.messages / f"{task_id}-{self.id}.json"
            with open(file_path, "w") as f:
                json.dump(messages_json, f, indent=2)

    def load_chat_history(self):
        pass

    async def emit_event(self, state: ExecutionState, data: EventData):
        if self.context:
            await self.context.event_manager.emit(Event.create(
                state=state,
                actor=self.id,
                data=data
            ))

    @abstractmethod
    async def process_request(
        self,
        user_input: str | BaseModel,
        additional_params: Optional[Dict[str, Any]] = None
    ) -> AgentOutput:
        pass