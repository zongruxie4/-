import time
import logging
from dataclasses import dataclass
from typing import Optional
from playwright.async_api import BrowserContext as PlaywrightBrowserContext, Page
from .dom.dom_mutation_observer import handle_navigation_for_mutation_observer, dom_mutation_change_detected

logger = logging.getLogger(__name__)

@dataclass
class PageInfo:
    """Information about the current page"""
    url: str  # current url
    title: str  # current title
    screenshot: Optional[str] = None  # current screenshot

@dataclass
class BrowserContextOptions:
    home_page: str
    screenshots_dir: str
    screenshot_capture_enabled: bool

class BrowserContext:
    def __init__(self, context: PlaywrightBrowserContext, options: BrowserContextOptions):
        self._context = context
        # the current page that is being operated on
        self._current_page = None
        self._home_page = options.home_page
        self._screenshots_dir = options.screenshots_dir
        self._screenshot_capture_enabled = options.screenshot_capture_enabled

    async def set_current_page(self, nano_tab_id: str) -> Page:
        # if there is a specific nano_tab_id, try to find the page with that id
        if nano_tab_id is not None:
            for page in self._context.pages:
                if not page.is_closed() and not page.url.startswith(("chrome-extension://", "chrome://", "edge://")):
                    id = await page.evaluate("document.body.getAttribute('data-nano-tab-id')")
                    logger.debug(f"\tPage ID: {id}, URL: {page.url}")
                    if id == nano_tab_id:
                        await self._setup_handlers(page)
                        self._current_page = page
                        return page
            self._current_page = None
            logger.warning(f"Page with nano_tab_id {nano_tab_id} not found")

        # if there is a current page, return it
        if self._current_page is not None:
            return self._current_page
        
        # if there is no current page, create a new one and goto home page
        page = await self._context.new_page()
        logger.debug(f"Creating new page: {page.url}")
        await page.goto(self._home_page)
        await page.bring_to_front()

        await self._setup_handlers(page)
        self._current_page = page
        return page

    async def get_current_page(self):
        if self._current_page is None:
            self._current_page = await self.set_current_page(None)
        return self._current_page

    async def get_current_page_info(self) -> PageInfo:
        page = await self.get_current_page()
        title = await page.title()
        url = page.url
        return PageInfo(url=url, title=title)
    
    async def _setup_handlers(self, page: Page):
        # Check if handler already exists using a custom attribute
        handler_exists = getattr(page, '_navigation_handler_added', False)
        if not handler_exists:
            # Add new handler only if it doesn't exist
            logger.debug(f"Adding navigation handler on page: {page.url}")
            page.on("domcontentloaded", handle_navigation_for_mutation_observer)
            # Mark that we've added the handler
            setattr(page, '_navigation_handler_added', True)
        else:
            logger.debug("Navigation handler already exists, skipping addition")

        # Only expose the function if it hasn't been exposed yet
        try:
            await page.expose_function("dom_mutation_change_detected", dom_mutation_change_detected)
        except Exception as e:
            # Ignore errors if function is already exposed
            if "already registered" not in str(e):
                # only log error for now
                logger.error(f"Error exposing function: {e}")

        logger.debug(f"Navigation handler setup complete for page: {page.url}")
    
    async def get_current_url(self):
        page = await self.get_current_page()
        return page.url
    
    async def highlight_element(self, selector: str, add_highlight: bool):
        try:
            page: Page = await self.get_current_page()
            if add_highlight:
                # Add the 'agente-ui-automation-highlight' class to the element. This class is used to apply the fading border.
                await page.eval_on_selector(selector, '''e => {
                            let originalBorderStyle = e.style.border;
                            e.classList.add('agente-ui-automation-highlight');
                            e.addEventListener('animationend', () => {
                                e.classList.remove('agente-ui-automation-highlight')
                            });}''')
                logger.debug(f"Applied pulsating border to element with selector {selector} to indicate text entry operation")
            else:
                # Remove the 'agente-ui-automation-highlight' class from the element.
                await page.eval_on_selector(selector, "e => e.classList.remove('agente-ui-automation-highlight')")
                logger.debug(f"Removed pulsating border from element with selector {selector} after text entry operation")
        except Exception:
            # This is not significant enough to fail the operation
            pass

    async def take_screenshots(self, name: str, page: Page|None, full_page: bool = True, include_timestamp: bool = True,
                               load_state: str = 'domcontentloaded', take_snapshot_timeout: int = 5*1000):
        if not self._screenshot_capture_enabled:
            return
        if page is None:
            page = await self.get_current_page()

        screenshot_name = name

        if include_timestamp:
            screenshot_name = f"{int(time.time_ns())}_{screenshot_name}"
        screenshot_name += ".png"
        screenshot_path = f"{self.get_screenshots_dir()}/{screenshot_name}"
        try:
            await page.wait_for_load_state(state=load_state, timeout=take_snapshot_timeout) # type: ignore
            await page.screenshot(path=screenshot_path, full_page=full_page, timeout=take_snapshot_timeout, caret="initial", scale="device")
            logger.debug(f"Screen shot saved to: {screenshot_path}")
        except Exception as e:
            logger.error(f"Failed to take screenshot and save to \"{screenshot_path}\". Error: {e}")

    async def close(self):
        try:
            if self._current_page is not None:
                # Wait for any pending operations to complete
                try:
                    await self._current_page.wait_for_load_state('load', timeout=5000)
                except Exception:
                    # Ignore timeout or other errors during wait
                    pass
                
                current_page = self._current_page
                # Clear reference first
                self._current_page = None
                # Then close the page
                await current_page.close()
            
            # Handle context cleanup separately
            if self._context is not None:
                context = self._context
                self._context = None
                await context.close()
                
        except Exception as e:
            logger.error(f"Error while closing browser context: {e}")
            raise

