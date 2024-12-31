import asyncio
import inspect
import logging
from pydantic import Field
from .click_using_selector import do_click
from .enter_text_using_selector import do_entertext
from .press_key_combination import do_press_key_combination
from langchain_core.tools import tool
from ..context import AgentContext, Actors
from ..event import Event, ExecutionState, EventData
from .base import BaseToolArgsWithContextSchema 

logger = logging.getLogger(__name__)

class EnterTextAndClickArgsSchema(BaseToolArgsWithContextSchema):
    text_selector: str = Field(description="The properly formatted DOM selector query, for example [mmid='1234'], where the text will be entered. Use mmid attribute.")
    text_to_enter: str = Field(description="The text that will be entered into the element specified by text_selector.")
    click_selector: str = Field(description="The properly formatted DOM selector query, for example [mmid='1234'], for the element that will be clicked after text entry.")
    wait_before_click_execution: float = Field(description="Optional wait time in seconds before executing the click.", default=0.0)


@tool(args_schema=EnterTextAndClickArgsSchema)
async def enter_text_and_click(
    context: AgentContext,
    text_selector: str,
    text_to_enter: str,
    click_selector: str,
    wait_before_click_execution: float = 0.0
) -> str:
    """
    Enters text into an element and then clicks on another element.

    Returns:
    - A message indicating the success or failure of the text entry and click.

    Raises:
    - ValueError: If no active page is found. The OpenURL command opens a new page.

    Example usage:
    ```
    await enter_text_and_click("[mmid='1234']", "Hello, World!", "[mmid='5678']", wait_before_click_execution=1.5)
    ```
    """
    # logger.info(f"Entering text '{text_to_enter}' into element with selector '{text_selector}' and then clicking element with selector '{click_selector}'.")
    event_manager = context.event_manager
    await event_manager.emit(Event.create(
        state=ExecutionState.ACT_START,
        actor=Actors.NAVIGATOR,
        data=EventData(
            task_id=context.task_id,
            step=context.step,
            tool_round=context.tool_round,
            tool="enter_text_and_click",
            details=f"Entering text '{text_to_enter}' into element with selector '{text_selector}'."
        )
    ))

    # Initialize PlaywrightManager and get the active browser page
    browser_context = context.browser_context
    page = await browser_context.get_current_page()
    if page is None: # type: ignore
        logger.error("No active page found")
        raise ValueError('No active page found. OpenURL command opens a new page.')

    await browser_context.highlight_element(text_selector, True)

    function_name = inspect.currentframe().f_code.co_name # type: ignore
    await browser_context.take_screenshots(f"{function_name}_start", page)

    text_entry_result = await do_entertext(context, page, text_selector, text_to_enter, use_keyboard_fill=True)

    #await browser_manager.notify_user(text_entry_result["summary_message"])
    await event_manager.emit(Event.create(
        state=ExecutionState.ACT_OK,
        actor=Actors.NAVIGATOR,
        data=EventData(
            task_id=context.task_id,
            step=context.step,
            tool_round=context.tool_round,
            tool="enter_text_and_click",
            details=text_entry_result["summary_message"]
        )
    ))
    if not text_entry_result["summary_message"].startswith("Success"):
        await browser_context.take_screenshots(f"{function_name}_end", page)
        return(f"Failed to enter text '{text_to_enter}' into element with selector '{text_selector}'. Check that the selctor is valid.")

    result = text_entry_result

    # emit event
    await event_manager.emit(Event.create(
        state=ExecutionState.ACT_START,
        actor=Actors.NAVIGATOR,
        data=EventData(
            task_id=context.task_id,
            step=context.step,
            tool_round=context.tool_round,
            tool="enter_text_and_click",
            details=f"Clicking element: \"{click_selector}\""
        )
    ))

    click_result = ""

    #if the text_selector is the same as the click_selector, press the Enter key instead of clicking
    if text_selector == click_selector:
        do_press_key_combination_result = await do_press_key_combination(browser_context, page, "Enter")
        if do_press_key_combination_result:
            result["detailed_message"] += f" Instead of click, pressed the Enter key successfully on element: \"{click_selector}\"."
            # await browser_manager.notify_user(f"Pressed the Enter key successfully on element: \"{click_selector}\".", message_type=MessageType.ACTION)
            click_result = "Pressed the Enter key successfully on element: \"{click_selector}\""
        else:
            result["detailed_message"] += f" Clicking the same element after entering text in it, is of no value. Tried pressing the Enter key on element \"{click_selector}\" instead of click and failed."
            # await browser_manager.notify_user("Failed to press the Enter key on element \"{click_selector}\".", message_type=MessageType.ACTION)
            click_result = "Failed to press the Enter key on element \"{click_selector}\""
    else:
        await browser_context.highlight_element(click_selector, True)

        do_click_result = await do_click(page, click_selector, wait_before_click_execution)
        result["detailed_message"] += f' {do_click_result["detailed_message"]}'
        #await browser_manager.notify_user(do_click_result["summary_message"])
        click_result = do_click_result["summary_message"]

    await event_manager.emit(Event.create(
        state=ExecutionState.ACT_OK,
        actor=Actors.NAVIGATOR,
        data=EventData(
            task_id=context.task_id,
            step=context.step,
            tool_round=context.tool_round,
            tool="enter_text_and_click",
            details=click_result
        )
    ))
    
    await asyncio.sleep(0.1) # sleep for 100ms to allow the mutation observer to detect changes

    await browser_context.take_screenshots(f"{function_name}_end", page)

    return result["detailed_message"]
