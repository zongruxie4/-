import asyncio
import json
import websockets
import logging
from typing import Set
from pathlib import Path
from websockets.server import WebSocketServerProtocol
from ..agent.executor import Executor
from ..agent.event.base import Event
from .message import (
    CreateTaskMessage, TaskStateMessage, WebSocketMessage, WebSocketMessageKind, ErrorMessage
)
from .task import TaskManager, Task
from ..utils.path_manager import PathManager

logger = logging.getLogger(__name__)

# Only allow one connection for now
MAX_CONNECTIONS = 1

class WebSocketServer:
    def __init__(self, base_dir: Path, executor: Executor):
        self._path_manager = PathManager(base_dir)
        self._active_connections: Set[WebSocketServerProtocol] = set()
        self._executor = executor
        self._task_manager = TaskManager(self._path_manager.tasks)
        self._connection_lock = asyncio.Lock()  # Add lock for thread safety
        # Subscribe to task execution state changes
        asyncio.create_task(self._subscribe_to_execution_state())

    async def _subscribe_to_execution_state(self):
        """Subscribe to task execution state changes and broadcast them to clients"""
        async def handle_state_event(event: Event):
            for websocket in self._active_connections:
                try:
                    self._task_manager.update_task_execution_state(event)
                    await self._send_task_state(websocket, event)
                except Exception as e:
                    logger.error(f"Failed to send agent event to client: {e}")

        await self._executor.subscribe_execution_state(handle_state_event)

    async def _register(self, websocket: WebSocketServerProtocol):
        client_info = f"{websocket.remote_address[0]}:{websocket.remote_address[1]}"
        
        async with self._connection_lock:  # Ensure thread-safe check and add
            if len(self._active_connections) >= MAX_CONNECTIONS:
                logger.warning(f"Rejected connection from {client_info}: Maximum connection limit reached")
                await websocket.close(1013, "Maximum connection limit reached")
                return
            self._active_connections.add(websocket)
            logger.info(f"New client connected from {client_info}. Total active connections: {len(self._active_connections)}")

        try:
            await self._handle_connection(websocket)
        finally:
            async with self._connection_lock:  # Ensure thread-safe removal
                self._active_connections.remove(websocket)
                logger.info(f"Client disconnected from {client_info}. Remaining active connections: {len(self._active_connections)}")

    async def _handle_connection(self, websocket: WebSocketServerProtocol):
        try:
            async for message in websocket:
                try:
                    data = json.loads(message)
                    message = WebSocketMessage.model_validate(data)

                    if message.kind == WebSocketMessageKind.CREATE:
                        logger.debug(f"Received create_task message: {data}")
                        await self._handle_create_task(message.data, websocket)
                    elif message.kind == WebSocketMessageKind.CANCEL:
                        logger.debug(f"Received cancel_task message: {data}")
                        await self._handle_cancel_task(message.data, websocket)
                    elif message.kind == WebSocketMessageKind.HEARTBEAT:
                        ack_message = WebSocketMessage(
                            kind=WebSocketMessageKind.ACK,
                            data=message.data
                        )
                        await websocket.send(json.dumps(ack_message.model_dump(mode='json')))
                    else:
                        logger.error(f"Unknown message kind: {message.kind}")

                except json.JSONDecodeError:
                    logger.error("Failed to decode JSON message")
                except Exception as e:
                    logger.error(f"Unexpected error occurred: {str(e)}", exc_info=True)

        except websockets.exceptions.ConnectionClosed as e:
            logger.error(f"WebSocket connection closed: {e}")
        except Exception as e:
            logger.error(f"Unexpected error occurred: {str(e)}", exc_info=True)

    async def _process_task(self, task: Task, websocket: WebSocketServerProtocol):
        """Run task"""
        try:
            # Run task using executor
            await self._executor.run(
                task=task.intent,
                task_id=task.id,
                **task.args
            )
        except Exception as e:
            error_message = str(e)
            logger.error(f"Task failed: {error_message}", exc_info=True)
            await self._send_error_message(websocket, task.id, error_message)
        finally:
            self._task_manager.close_task()

    async def _handle_create_task(self, message_data: dict, websocket: WebSocketServerProtocol):
        """Handle create_task message"""
        try:
            create_msg = CreateTaskMessage.model_validate(message_data)
            task = self._task_manager.create_task(
                create_msg.task_id,
                create_msg.intent, 
                create_msg.args 
            )
            # Start task processing in the background
            asyncio.create_task(self._process_task(task, websocket))
        except Exception as e:
            logger.error(f"Error creating task: {str(e)}", exc_info=True)
            task_id = task.id if task else "unknown"
            await self._send_error_message(websocket, task_id, str(e))
            

    async def _handle_cancel_task(self, message_data: dict, websocket: WebSocketServerProtocol):
        """Handle cancel_task message"""
        raise NotImplementedError("Cancel task is not implemented")

    async def _send_task_state(self, websocket: WebSocketServerProtocol, event: Event):
        """Send task state update to client"""
        state = TaskStateMessage.from_event(event)
        message = WebSocketMessage(
            kind=WebSocketMessageKind.TASK_STATE,
            data=state.model_dump()
        )
        await websocket.send(json.dumps(message.model_dump(mode='json')))

    async def _send_error_message(self, websocket: WebSocketServerProtocol, task_id: str, error_message: str):
        """Send error message to client"""
        message = WebSocketMessage(
            kind=WebSocketMessageKind.ERROR,
            data=ErrorMessage(
                task_id=task_id,
                message=error_message
            ).model_dump()
        )
        await websocket.send(json.dumps(message.model_dump(mode='json')))


async def start_server(host: str, port: int, base_dir: Path, executor: Executor):
    server = WebSocketServer(base_dir, executor)
    async with websockets.serve(
        server._register, 
        host, 
        port,
        ping_interval=20,
        ping_timeout=20
    ):
        logger.info(f"WebSocket server started on ws://{host}:{port}")
        await asyncio.Future()