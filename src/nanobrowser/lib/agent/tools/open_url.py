import inspect
import logging
from pydantic import Field
from playwright.async_api import TimeoutError as PlaywrightTimeoutError
from langchain_core.tools import tool
from ..context import AgentContext, Actors
from ..event import Event, ExecutionState, EventData
from .base import BaseToolArgsWithContextSchema

logger = logging.getLogger(__name__)

class OpenUrlArgsSchema(BaseToolArgsWithContextSchema):
    url: str = Field(description="The URL to navigate to. Value must include the protocol (http:// or https://).")
    timeout: int = Field(description="Additional wait time in seconds after initial load. Default is 3 seconds.", default=3)

@tool(args_schema=OpenUrlArgsSchema)
async def openurl(context: AgentContext, url: str, timeout: int = 3) -> str:
    """
    Opens a specified URL in the active browser instance. Waits for an initial load event, then waits for either
    the 'domcontentloaded' event or a configurable timeout, whichever comes first.

    Returns:
    - URL of the new page.
    """
    # logger.info(f"Opening URL: {url}")

    # emit event
    event_manager = context.event_manager
    await event_manager.emit(Event.create(
        state=ExecutionState.ACT_START,
        actor=Actors.NAVIGATOR,
        data=EventData(
            task_id=context.task_id,
            step=context.step,
            tool_round=context.tool_round,
            tool="openurl",
            details=f"Opening URL: {url}"
        )
    ))

    # browser_manager = PlaywrightManager(PlaywrightOptions())
    # await browser_manager.get_browser_context()
    browser_context = context.browser_context
    page = await browser_context.get_current_page()
    try:
        url = ensure_protocol(url)
        if page.url == url:
            logger.info(f"Current page URL is the same as the new URL: {url}. No need to refresh.")
            title = await page.title()
            
            msg = f"Page already loaded: {url}, Title: {title}"
            # emit event
            await event_manager.emit(Event.create(
                state=ExecutionState.ACT_OK,
                actor=Actors.NAVIGATOR,
                data=EventData(
                    task_id=context.task_id,
                    step=context.step,
                    tool_round=context.tool_round,
                    tool="openurl",
                    details=msg
                )
            ))
            return msg # type: ignore

        # Navigate to the URL with a short timeout to ensure the initial load starts
        function_name = inspect.currentframe().f_code.co_name # type: ignore
        
        await browser_context.take_screenshots(f"{function_name}_start", page)

        await page.goto(url, timeout=timeout*1000) # type: ignore
    except PlaywrightTimeoutError as pte:
        logger.warn(f"Initial navigation to {url} failed: {pte}. Will try to continue anyway.") # happens more often than not, but does not seem to be a problem
    except Exception as e:
        logger.error(f"An error occurred while opening the URL: {url}. Error: {e}")
        import traceback
        traceback.print_exc()

    await browser_context.take_screenshots(f"{function_name}_end", page)

    # await browser_context.notify_user(f"Opened URL: {url}", message_type=MessageType.ACTION)
        # Get the page title
    title = await page.title()
    msg = f"Page loaded: {page.url}, Title: {title}"
    # emit event
    await event_manager.emit(Event.create(
        state=ExecutionState.ACT_OK,
        actor=Actors.NAVIGATOR,
        data=EventData(
            task_id=context.task_id,
            step=context.step,
            tool_round=context.tool_round,
            tool="openurl",
            details=msg
        )
    ))
    return msg # type: ignore

def ensure_protocol(url: str) -> str:
    """
    Ensures that a URL has a protocol (http:// or https://). If it doesn't have one,
    https:// is added by default.

    Parameters:
    - url: The URL to check and modify if necessary.

    Returns:
    - A URL string with a protocol.
    """
    if not url.startswith(('http://', 'https://')):
        url = 'https://' + url  # Default to http if no protocol is specified
        logger.info(f"Added 'https://' protocol to URL because it was missing. New URL is: {url}")
    return url
