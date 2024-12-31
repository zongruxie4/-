import asyncio
import inspect
import traceback
import logging
from typing import List  # noqa: UP035
from pydantic import Field
from playwright.async_api import Page
from langchain_core.tools import tool
from .press_key_combination import execute_press_key_combination
from ...browser.dom.dom_helper import get_element_outer_html
from ...browser.dom.dom_mutation_observer import subscribe
from ...browser.dom.dom_mutation_observer import unsubscribe
from ..context import AgentContext, Actors
from ..event import Event, ExecutionState, EventData
from .base import BaseToolArgsWithContextSchema

logger = logging.getLogger(__name__)

async def custom_fill_element(page: Page, selector: str, text_to_enter: str):
    """
    Sets the value of a DOM element to a specified text without triggering keyboard input events.

    This function directly sets the 'value' property of a DOM element identified by the given CSS selector,
    effectively changing its current value to the specified text. This approach bypasses the need for
    simulating keyboard typing, providing a more efficient and reliable way to fill in text fields,
    especially in automated testing scenarios where speed and accuracy are paramount.

    Args:
        page (Page): The Playwright Page object representing the browser tab in which the operation will be performed.
        selector (str): The CSS selector string used to locate the target DOM element. The function will apply the
                        text change to the first element that matches this selector.
        text_to_enter (str): The text value to be set in the target element. Existing content will be overwritten.

    Example:
        await custom_fill_element(page, '#username', 'test_user')

    Note:
        This function does not trigger input-related events (like 'input' or 'change'). If application logic
        relies on these events being fired, additional steps may be needed to simulate them.
    """
    selector = f"{selector}"  # Ensures the selector is treated as a string
    try:
        result = await page.evaluate(
            """(inputParams) => {
            const selector = inputParams.selector;
            let text_to_enter = inputParams.text_to_enter;
            text_to_enter = text_to_enter.trim();
            const element = document.querySelector(selector);
            if (!element) {
                throw new Error(`Element not found: ${selector}`);
            }
            element.value = text_to_enter;
            return `Value set for ${selector}`;
        }""",
            {"selector": selector, "text_to_enter": text_to_enter},
        )
        logger.debug(f"custom_fill_element result: {result}")
    except Exception as e:
        logger.error(f"Error in custom_fill_element, Selector: {selector}, Text: {text_to_enter}. Error: {str(e)}")
        raise


class EnterTextArgsSchema(BaseToolArgsWithContextSchema):
    query_selector: str = Field(description="The valid DOM selector query, for example [mmid='1234'], where the text will be entered. Use mmid attribute.")
    text_to_enter: str = Field(description="The text that will be entered into the element specified by query_selector.")

@tool(args_schema=EnterTextArgsSchema)
async def entertext(context: AgentContext, query_selector: str, text_to_enter: str) -> str:
    """
    Enters text into a DOM element identified by a CSS selector.

    This function enters the specified text into a DOM element identified by the given CSS selector.
    It uses the Playwright library to interact with the browser and perform the text entry operation.
    The function supports both direct setting of the 'value' property and simulating keyboard typing.

    Returns:
        str: Explanation of the outcome of this operation.

    Example:
        result = await entertext('#username', 'test_user')
    """
    # logger.info(f"Entering text: {text_to_enter} into element with selector: {query_selector}")

    event_manager = context.event_manager
    await event_manager.emit(Event.create(
        state=ExecutionState.ACT_START,
        actor=Actors.NAVIGATOR,
        data=EventData(
            task_id=context.task_id,
            step=context.step,
            tool_round=context.tool_round,
            tool="entertext",
            details=f"Entering text: {text_to_enter} into element with selector: {query_selector}"
        )
    ))

    # Create and use the PlaywrightManager
    browser_context = context.browser_context
    page = await browser_context.get_current_page()
    if page is None: # type: ignore
        return "Error: No active page found. OpenURL command opens a new page."

    function_name = inspect.currentframe().f_code.co_name # type: ignore

    await browser_context.take_screenshots(f"{function_name}_start", page)

    await browser_context.highlight_element(query_selector, True)

    dom_changes_detected=None
    def detect_dom_changes(changes:str): # type: ignore
        nonlocal dom_changes_detected
        dom_changes_detected = changes # type: ignore

    subscribe(detect_dom_changes)

    await page.evaluate(
        """
        (selector) => {
            const element = document.querySelector(selector);
            if (element) {
                element.value = '';
            } else {
                console.error('Element not found:', selector);
            }
        }
        """,
        query_selector,
    )

    result = await do_entertext(context, page, query_selector, text_to_enter)
    await asyncio.sleep(0.1) # sleep for 100ms to allow the mutation observer to detect changes
    unsubscribe(detect_dom_changes)

    await browser_context.take_screenshots(f"{function_name}_end", page)

    # await browser_context.notify_user(result["summary_message"], message_type=MessageType.ACTION)
    await event_manager.emit(Event.create(
        state=ExecutionState.ACT_OK,
        actor=Actors.NAVIGATOR,
        data=EventData(
            task_id=context.task_id,
            step=context.step,
            tool_round=context.tool_round,
            tool="entertext",
            details=result["summary_message"]
        )
    ))
    if dom_changes_detected:
        return f"{result['detailed_message']}.\n As a consequence of this action, new elements have appeared in view: {dom_changes_detected}. This means that the action of entering text {text_to_enter} is not yet executed and needs further interaction. Get all_fields DOM to complete the interaction."
    return result["detailed_message"]


async def do_entertext(context: AgentContext, page: Page, selector: str, text_to_enter: str, use_keyboard_fill: bool=False):
    """
    Performs the text entry operation on a DOM element.

    This function performs the text entry operation on a DOM element identified by the given CSS selector.
    It applies a pulsating border effect to the element during the operation for visual feedback.
    The function supports both direct setting of the 'value' property and simulating keyboard typing.

    Args:
        page (Page): The Playwright Page object representing the browser tab in which the operation will be performed.
        selector (str): The CSS selector string used to locate the target DOM element.
        text_to_enter (str): The text value to be set in the target element. Existing content will be overwritten.
        use_keyboard_fill (bool, optional): Determines whether to simulate keyboard typing or not.
                                            Defaults to False.

    Returns:
        dict[str, str]: Explanation of the outcome of this operation represented as a dictionary with 'summary_message' and 'detailed_message'.

    Example:
        result = await do_entertext(page, '#username', 'test_user')

    Note:
        - The 'use_keyboard_fill' parameter determines whether to simulate keyboard typing or not.
        - If 'use_keyboard_fill' is set to True, the function uses the 'page.keyboard.type' method to enter the text.
        - If 'use_keyboard_fill' is set to False, the function uses the 'custom_fill_element' method to enter the text.
    """
    try:

        logger.debug(f"Looking for selector {selector} to enter text: {text_to_enter}")

        elem = await page.query_selector(selector)

        if elem is None:
            error = f"Error: Selector {selector} not found. Unable to continue."
            return {"summary_message": error, "detailed_message": error}

        logger.info(f"Found selector {selector} to enter text")
        element_outer_html = await get_element_outer_html(elem, page)

        # TODO: remove this after testing
        # use_keyboard_fill = False
        if use_keyboard_fill:
            await elem.focus()
            await asyncio.sleep(0.1)
            await execute_press_key_combination(context, "Control+A")
            await asyncio.sleep(0.1)
            await execute_press_key_combination(context, "Backspace")
            await asyncio.sleep(0.1)
            logger.debug(f"Focused element with selector {selector} to enter text")
            # add a 100ms delay
            await page.keyboard.type(text_to_enter, delay=1)
        else:
            await custom_fill_element(page, selector, text_to_enter)
        await elem.focus()
        logger.info(f"Success. Text \"{text_to_enter}\" set successfully in the element with selector {selector}")
        success_msg = f"Success. Text \"{text_to_enter}\" set successfully in the element with selector {selector}"
        return {"summary_message": success_msg, "detailed_message": f"{success_msg} and outer HTML: {element_outer_html}."}

    except Exception as e:
        traceback.print_exc()
        error = f"Error entering text in selector {selector}."
        return {"summary_message": error, "detailed_message": f"{error} Error: {e}"}



class BulkEnterTextArgsSchema(BaseToolArgsWithContextSchema):   
    entries: List[dict[str, str]] = Field(description="List of entries, each containing 'query_selector' and 'text'.")

@tool(args_schema=BulkEnterTextArgsSchema)
async def bulk_enter_text(context: AgentContext, entries: List[dict[str, str]]) -> List[dict[str, str]]:
    """
    Enters text into multiple DOM elements using a bulk operation.

    This function enters text into multiple DOM elements using a bulk operation.
    It takes a list of dictionaries, where each dictionary contains a 'query_selector' and 'text' pair.
    The function internally calls the 'entertext' function to perform the text entry operation for each entry.

    Returns:
        List of dictionaries, each containing 'query_selector' and the result of the operation.

    Example:
        entries = [
            {"query_selector": "#username", "text": "test_user"},
            {"query_selector": "#password", "text": "test_password"}
        ]
        results = await bulk_enter_text(entries)
    """

    results: List[dict[str, str]] = []  # noqa: UP006
    logger.info("Executing bulk Enter Text Command")
    for entry in entries:
        query_selector = entry['query_selector']
        text_to_enter = entry['text']
        logger.info(f"Entering text: {text_to_enter} in element with selector: {query_selector}")
        result = await entertext(context, query_selector, text_to_enter)

        results.append({"query_selector": query_selector, "result": result})

    return results
