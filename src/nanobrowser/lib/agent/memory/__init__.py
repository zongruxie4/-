"""
Memory module for the agent.
"""
from .base import BaseChatHistory
from .in_memory_history import InMemoryChatHistory


__all__ = [
    "BaseChatHistory",
    "InMemoryChatHistory"
]