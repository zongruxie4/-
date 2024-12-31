from abc import ABC, abstractmethod
from typing import List, Callable
from langchain_core.messages import BaseMessage

class BaseChatHistory(ABC):

    @abstractmethod
    def length(self) -> int:
        pass

    @abstractmethod
    def clear(self):
        pass

    @abstractmethod
    def add_message(self, message: BaseMessage):
        pass

    @abstractmethod
    def remove_message(self, message: BaseMessage):
        pass

    @abstractmethod
    def get_messages(self) -> List[BaseMessage]:
        pass

    @abstractmethod
    def trim_messages(self, max_tokens: int, token_counter: Callable[[list[BaseMessage]], int]):
        pass