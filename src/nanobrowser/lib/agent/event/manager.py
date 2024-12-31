import asyncio
from typing import Dict, List
from .base import EventType, Event, EventCallback

class EventManager:
    def __init__(self):
        self._subscribers: Dict[EventType, List[EventCallback]] = {}

    def subscribe(self, event_type: EventType, callback: EventCallback):
        if event_type not in self._subscribers:
            self._subscribers[event_type] = []
        if not any(cb is callback for cb in self._subscribers[event_type]):
            self._subscribers[event_type].append(callback)

    def unsubscribe(self, event_type: EventType, callback: EventCallback):
        if event_type in self._subscribers:
            self._subscribers[event_type] = [
                cb for cb in self._subscribers[event_type] 
                if cb is not callback  # Use identity comparison instead of equality
            ]

    async def emit(self, event: Event):        
        if event.type in self._subscribers:
            await asyncio.gather(
                *[callback(event) for callback in self._subscribers[event.type]]
            )