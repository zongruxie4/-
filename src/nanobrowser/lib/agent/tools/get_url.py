from langchain_core.tools import tool
from ..context import AgentContext
from .base import BaseToolArgsWithContextSchema


@tool(args_schema=BaseToolArgsWithContextSchema)
async def geturl(context: AgentContext) -> str:
    """
    Returns the full URL of the current page

    Returns:
    - Full URL the browser's active page.
    """


    try:
        # Create and use the PlaywrightManager
        browser_context = context.browser_context
        page = await browser_context.get_current_page()

        if not page:
            raise ValueError('No active page found. OpenURL command opens a new page.')

        await page.wait_for_load_state("domcontentloaded")

        # Get the URL of the current page
        try:
            title = await page.title()
            current_url = page.url
            if len(current_url) >250:
                current_url = current_url[:250] + "..."
            return f"Current Page: {current_url}, Title: {title}" # type: ignore
        except:  # noqa: E722
            current_url = page.url
            return f"Current Page: {current_url}"

    except Exception as e:
        raise ValueError('No active page found. OpenURL command opens a new page.') from e

