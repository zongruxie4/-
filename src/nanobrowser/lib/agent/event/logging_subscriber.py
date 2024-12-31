import logging
from .base import Event

logger = logging.getLogger(__name__)

class TaskEventLogger:
    @staticmethod
    async def handle_event(event: Event):
        # Build log message parts
        base_msg = f"TASK[{event.data.task_id}]: {event.data.step}:{event.data.tool_round}: {event.state.value} from {event.actor}"
        details = [event.data.details] 

        # Add optional components only if they have values
        # if it's final
        if hasattr(event.data, 'final') and event.data.final:
            details.append(f"final: {event.data.final}")
        # if it has a plan
        if hasattr(event.data, 'plan') and event.data.plan:
            details.append(f"plan: {event.data.plan}")
        # if it has a tool
        if hasattr(event.data, 'tool') and event.data.tool:
            details.append(f"tool: {event.data.tool}")

        log_msg = f"{base_msg} - {' | '.join(details)}"
        logger.info(log_msg) 
