import asyncio
import inspect
import logging
from pydantic import Field
from langchain_core.tools import tool
from playwright.async_api import Page  # type: ignore
from ...browser.dom.dom_mutation_observer import subscribe  # type: ignore
from ...browser.dom.dom_mutation_observer import unsubscribe  # type: ignore
from ..context import AgentContext, Actors
from ...browser.context import BrowserContext
from ..event import Event, ExecutionState, EventData
from .base import BaseToolArgsWithContextSchema

logger = logging.getLogger(__name__)

class PressKeyCombinationArgsSchema(BaseToolArgsWithContextSchema):
    key_combination: str = Field(description="The key combination to press, use '+' as a separator for combinations. e.g., 'Control+C'.")

@tool(args_schema=PressKeyCombinationArgsSchema)
async def press_key_combination(context: AgentContext, key_combination: str) -> str:
    """
    Presses a key combination on the current active page managed by PlaywrightManager.

    This function simulates the pressing of a key or a combination of keys on the current active web page.
    The `key_combination` should be a string that represents the keys to be pressed, separated by '+' if it's a combination.
    For example, 'Control+C' to copy or 'Alt+F4' to close a window on Windows.

    Returns:
    str: status of the operation expressed as a string
    """
    return await execute_press_key_combination(context, key_combination)

async def execute_press_key_combination(context: AgentContext, key_combination: str) -> str:
   
    # logger.info(f"Executing press_key_combination with key combo: {key_combination}")
    event_manager = context.event_manager
    await event_manager.emit(Event.create(
        state=ExecutionState.ACT_START,
        actor=Actors.NAVIGATOR,
        data=EventData(
            task_id=context.task_id,
            step=context.step,
            tool_round=context.tool_round,
            tool="press_key_combination",
            details=f"Executing press_key_combination with key combo: {key_combination}"
        )
    ))
    # Create and use the PlaywrightManager
    browser_context = context.browser_context
    page = await browser_context.get_current_page()

    if page is None: # type: ignore
        raise ValueError('No active page found. OpenURL command opens a new page.')

    # Split the key combination if it's a combination of keys
    keys = key_combination.split('+')

    dom_changes_detected=None
    def detect_dom_changes(changes:str): # type: ignore
        nonlocal dom_changes_detected
        dom_changes_detected = changes # type: ignore

    subscribe(detect_dom_changes)
    # If it's a combination, hold down the modifier keys
    for key in keys[:-1]:  # All keys except the last one are considered modifier keys
        await page.keyboard.down(key)

    # Press the last key in the combination
    await page.keyboard.press(keys[-1])

    # Release the modifier keys
    for key in keys[:-1]:
        await page.keyboard.up(key)
    await asyncio.sleep(0.1) # sleep for 100ms to allow the mutation observer to detect changes
    unsubscribe(detect_dom_changes)

    await event_manager.emit(Event.create(
        state=ExecutionState.ACT_OK,
        actor=Actors.NAVIGATOR,
        data=EventData(
            task_id=context.task_id,
            step=context.step,
            tool_round=context.tool_round,
            tool="press_key_combination",
            details=f"Key {key_combination} executed successfully."
        )
    ))

    if dom_changes_detected:
        return f"Key {key_combination} executed successfully.\n As a consequence of this action, new elements have appeared in view:{dom_changes_detected}. This means that the action is not yet executed and needs further interaction. Get all_fields DOM to complete the interaction."

    # await browser_manager.notify_user(f"Key {key_combination} executed successfully", message_type=MessageType.ACTION)
    return f"Key {key_combination} executed successfully"


async def do_press_key_combination(browser_context: BrowserContext, page: Page, key_combination: str) -> bool:
    """
    Presses a key combination on the provided page.

    This function simulates the pressing of a key or a combination of keys on a web page.
    The `key_combination` should be a string that represents the keys to be pressed, separated by '+' if it's a combination.
    For example, 'Control+C' to copy or 'Alt+F4' to close a window on Windows.

    Parameters:
    - browser_manager (PlaywrightManager): The PlaywrightManager instance.
    - page (Page): The Playwright page instance.
    - key_combination (str): The key combination to press, represented as a string. For combinations, use '+' as a separator.

    Returns:
    bool: True if success and False if failed
    """

    logger.info(f"Executing press_key_combination with key combo: {key_combination}")
    try:
        function_name = inspect.currentframe().f_code.co_name # type: ignore
        await browser_context.take_screenshots(f"{function_name}_start", page)
        # Split the key combination if it's a combination of keys
        keys = key_combination.split('+')

        # If it's a combination, hold down the modifier keys
        for key in keys[:-1]:  # All keys except the last one are considered modifier keys
            await page.keyboard.down(key)

        # Press the last key in the combination
        await page.keyboard.press(keys[-1])

        # Release the modifier keys
        for key in keys[:-1]:
            await page.keyboard.up(key)

    except Exception as e:
        logger.error(f"Error executing press_key_combination \"{key_combination}\": {e}")
        return False

    await browser_context.take_screenshots(f"{function_name}_end", page)

    return True

