from typing import List, Callable
from langchain_core.messages import BaseMessage
from langchain_core.messages.utils import trim_messages
from .base import BaseChatHistory

class InMemoryChatHistory(BaseChatHistory):
    messages: List[BaseMessage] = []

    def length(self):
        return len(self.messages)
    
    def clear(self):
        self.messages = []

    def add_message(self, message: BaseMessage):
        self.messages.append(message)

    def remove_message(self, message: BaseMessage):
        self.messages.remove(message)

    def get_messages(self) -> List[BaseMessage]:
        return self.messages
    
    def trim_messages(self, max_tokens: int, token_counter: Callable[[list[BaseMessage]], int]):
        self.messages = trim_messages(
            self.messages, 
            max_tokens=max_tokens, 
            token_counter=token_counter,
            strategy="last",
            include_system=True,
        )
    
 
