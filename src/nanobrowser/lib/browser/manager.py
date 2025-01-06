import requests
import logging
from dataclasses import dataclass
from typing import Optional
from playwright.async_api import async_playwright
from playwright.async_api import Playwright
from asyncio import Lock
from .launcher import ChromeLauncher
from .context import BrowserContext, BrowserContextOptions

logger = logging.getLogger(__name__)

@dataclass
class PlaywrightOptions:
    headless: bool = False
    screenshots_dir: str = ""
    # use screenshot capture to record the browser actions
    screenshot_capture_enabled: bool = False
    # use chrome app path to launch chrome in subprocess
    chrome_app_path: Optional[str] = None
    # use cdp port to connect to chrome over cdp
    cdp_port: Optional[int] = 9222

class PlaywrightManager:
    """
    A singleton class to manage Playwright instances and browsers.

    Only Chrome and Chromium browser are supported for now.
    """
    _instance = None
   

    def __new__(cls, *args, **kwargs): # type: ignore
        """
        Ensures that only one instance of PlaywrightManager is created (singleton pattern).
        """
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance


    def __init__(self, options: PlaywrightOptions):
        """
        Initializes the PlaywrightManager with the specified browser type and headless mode.
        Initialization occurs only once due to the singleton pattern.

        Args:
            options (PlaywrightOptions): The options for the PlaywrightManager.
        """
        # Only initialize if these attributes don't exist yet
        if not hasattr(self, '_homepage'):
            self._homepage = "https://www.google.com"

            self._playwright = None # type: ignore
            self._browser = None # type: ignore
            self._browser_context: BrowserContext | None = None
            self.__async_initialize_done = False
            self.__init_lock = Lock()

            self._chrome_app_path = options.chrome_app_path
            self._cdp_port = options.cdp_port
            self._headless = options.headless
            self._screenshot_capture_enabled = options.screenshot_capture_enabled
            self._screenshots_dir = options.screenshots_dir
            
            # use chrome launcher to launch chrome in subprocess
            self._chrome_launcher: ChromeLauncher | None = None
            self._user_agent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
            # https://peter.sh/experiments/chromium-command-line-switches/
            self._default_chrome_args = [ 
                '--disable-infobars',
                '--no-pings',
                '--disable-breakpad',
                '--disable-component-update',
                '--disable-background-timer-throttling',
                '--disable-popup-blocking',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding',
                '--no-first-run',
                '--no-default-browser-check',
                '--disable-dev-shm-usage'
            ]

    async def async_initialize(self):
        """
        Asynchronously initialize necessary components and handlers for the browser context.
        Thread-safe initialization using an asyncio Lock.
        """
        async with self.__init_lock:
            if self.__async_initialize_done:
                return

            if not self._playwright:
                self._playwright: Playwright = await async_playwright().start()
                logger.debug("Playwright instance created..")
            
            await self._connect_to_browser()
            await self.get_browser_context()

            # browser is launched by playwright, navigate to homepage
            if self._chrome_app_path is None and self._browser_context is not None:
                await self._browser_context.set_current_page(None)

            self.__async_initialize_done = True

    async def reinitialize(self):
        """
        Reinitialize the browser and browser context, useful when the browser connection is lost.
        """
        async with self.__init_lock:

            try:            
                if self._playwright is not None:
                    await self._playwright.stop()
                    self._playwright = None
            except Exception as e:
                logger.warning(f"Failed to stop playwright: {str(e)}")

            self.__async_initialize_done = False
            self._browser = None
            self._browser_context = None

        await self.async_initialize()

    async def _connect_to_browser(self):
        """
        Connects to a browser instance with remote debugging enabled.
        1. if chrome app path is not provided, launch a chromium browser instance
        2. if chrome app path is provided, try to connect to an existing browser instance with remote debugging enabled.
        3. if not successful, try to launch a new browser instance with remote debugging enabled.
        4. if not successful, raise an error.
        """
        try:
            if self._chrome_app_path is None:
                await self._launch_chrome_by_playwright()
                return True
            else:
                cdp_enabled = await self._is_chrome_cdp_enabled()
                if not cdp_enabled:
                    await self._launch_chrome_in_subprocess()
                     
            # finally try to connect over cdp
            self._browser = await self._playwright.chromium.connect_over_cdp(
                f"http://localhost:{self._cdp_port}",
            )
            if self._browser is None:
                raise RuntimeError("Failed to connect to chrome over CDP. Please close any existing chrome instances and try again.")
            return True
        except Exception:
            raise

    async def _is_chrome_cdp_enabled(self, timeout: int = 3):
        """
        Checks if a Chrome instance with remote debugging enabled is running.

        Args:
            timeout (int, optional): The timeout for the request in seconds. Defaults to 3.
        """
        try:
            response = requests.get(f"http://localhost:{self._cdp_port}/json/version", timeout=timeout)
            return response.status_code == 200
        except Exception:
            return False

    async def _launch_chrome_in_subprocess(self):
        """
        Launches the Chrome application with remote debugging enabled in a subprocess.
        """
        try:
            args = [f'--remote-debugging-port={self._cdp_port}']
            args.extend(self._default_chrome_args)

            self._chrome_launcher = ChromeLauncher(binary= self._chrome_app_path, args=args)
            await self._chrome_launcher.alaunch()

            # If a chrome instance is running before launching, the remote debugging would not be enabled.
            cdp_enabled = await self._is_chrome_cdp_enabled()
            if not cdp_enabled:
                raise RuntimeError("Chrome is launched in subprocess, but remote debugging not enabled. Please close any existing chrome instances and try again.")
        except Exception:
            raise
    
    async def _launch_chrome_by_playwright(self):
        """
        Launches the Google Chrome browser by playwright.
        """
        try:
            args= self._default_chrome_args.copy()
            args.append('--no-sandbox')
            args.append('--disable-blink-features=AutomationControlled')
            if self._headless:
                args.append('--disable-gpu')

            self._browser = await self._playwright.chromium.launch(
                channel= "chrome",
                headless=self._headless,
                args=args
            )
        except Exception as e:
            logger.error(f"Failed to launch Chrome browser by playwright: {e}")
            raise


    async def create_browser_context(self):
        try:
            if self._browser is None:
                raise ValueError("Browser is not initialized")

            context = None
            if len(self._browser.contexts) > 0:
                # pretty print the browser contexts
                logger.debug(f"Browser context already exists. Reusing it. {self._browser.contexts}")

                context = self._browser.contexts[0]
                logger.debug("Browser context already exists. Reusing it.")
            else:
                context = await self._browser.new_context(
                    no_viewport=True,
                    user_agent=self._user_agent,
                    java_script_enabled=True
                )
                logger.debug("Created new browser context")

            self._browser_context = BrowserContext(context, BrowserContextOptions(
                home_page=self._homepage,
                screenshots_dir=self._screenshots_dir,
                screenshot_capture_enabled=self._screenshot_capture_enabled
            ))
            return self._browser_context
        except Exception as e:
            logger.error(f"Failed to create browser context: {e}")
            raise e


    async def get_browser_context(self, refresh: bool = False):
        """
        Returns the existing browser context, or creates a new one if it doesn't exist.
        If refresh is True, the browser context will be refreshed.
        """
        if self._browser_context is None or refresh:
            logger.debug("Creating new browser context")
            await self.create_browser_context()
        return self._browser_context
    

    async def close(self):
        """
        Closes and cleans up all Playwright resources.
        This includes closing browser contexts, browser instances, and stopping the Playwright instance.
        """
        try:
            if self._browser_context is not None:
                await self._browser_context.close()

            if self._browser is not None:
                await self._browser.close()
            
            if self._playwright is not None:
                await self._playwright.stop()
                self._playwright = None

            if self._chrome_launcher is not None:
                await self._chrome_launcher.akill()
                self._chrome_launcher = None

            logger.info("Successfully closed all Playwright resources")
        except Exception as e:
            logger.error(f"Error while closing Playwright resources: {e}")
            raise
        finally:
            self._playwright = None
            self._browser = None
            self._browser_context = None
            self._chrome_launcher = None
            self.__async_initialize_done = False

