# original code from 
# https://github.com/HMaker/python-cdp/blob/master/pycdp/browser.py
import warnings
import os
import signal
import shutil
import tempfile
import subprocess
import typing as t
import asyncio
from io import TextIOWrapper
import logging

logger = logging.getLogger(__name__)

class BrowserLauncher():

    def __init__(
        self,
        *,
        binary: str,
        profile: str=None,
        keep_profile: bool=True,
        headless: bool=False,
        locale: str=None,
        timezone: str=None,
        proxy: str=None,
        window_width: int=None,
        window_height: int=None,
        initial_url: str=None,
        extensions: t.List[str]=[],
        args: t.List[str]=None,
        log: bool=False,
    ):
        self._binary = binary
        self._headless = headless
        self._locale = locale
        self._timezone = timezone
        self._proxy = proxy
        self._window_width = window_width
        self._window_height = window_height
        self._extensions = extensions
        self._initial_url = initial_url
        self._args = args
        self._log = log
        self._process: subprocess.Popen = None
        if profile is None:
            self._keep_profile = False
            self._profile = None
        else:
            self._profile = profile
            self._keep_profile = keep_profile
        self._logfile: TextIOWrapper = None

    @property
    def pid(self) -> int:
        return self._process.pid

    @property
    def locale(self):
        return self._locale

    @property
    def timezone(self):
        return self._timezone

    async def alaunch(self):
        await asyncio.get_running_loop().run_in_executor(None, self.launch)

    def launch(self):
        if self._process is not None: raise RuntimeError('already launched')
        if self._log:
            self._logfile = open(f'{self.__class__.__name__.lower()}.log', 'a')
            stdout = stderr = self._logfile
            logger.debug('redirecting output to %s.log', self.__class__.__name__.lower())
        else:
            stdout = stderr = subprocess.DEVNULL
            logger.debug('redirecting output to subprocess.DEVNULL')
        if self._profile is None:
            self._profile = tempfile.mkdtemp()
            self._configure_profile()
        cmd = self._build_launch_cmdline()
        logger.debug('launching %s', cmd)
        self._process = subprocess.Popen(
            cmd,
            env=self._build_launch_env(),
            stdin=subprocess.PIPE,
            stdout=stdout,
            stderr=stderr,
            text=True,
            close_fds=True,
            preexec_fn=os.setsid if os.name == 'posix' else None,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == 'nt' else 0
        )
        try:
            logger.debug('waiting launch finish...')
            returncode = self._process.wait(1)
        except subprocess.TimeoutExpired:
            logger.debug('launch finished')

    async def akill(self, timeout: float=3.0):
        await asyncio.get_running_loop().run_in_executor(None, self.kill, timeout)

    def kill(self, timeout: float=3.0):
        if self._process is not None:
            try:
                if os.name == 'posix':
                    try:
                        os.killpg(os.getpgid(self._process.pid), signal.SIGTERM)
                    except ProcessLookupError:
                        logger.debug('Process already terminated')
                else:
                    self._process.terminate()
                
                try:
                    self._process.wait(timeout)
                except subprocess.TimeoutExpired:
                    if os.name == 'posix':
                        try:
                            os.killpg(os.getpgid(self._process.pid), signal.SIGKILL)
                        except ProcessLookupError:
                            logger.debug('Process already terminated')
                    else:
                        self._process.kill()
                    
            finally:
                self._process = None
                if self._logfile is not None and not self._logfile.closed:
                    self._logfile.close()
                if not self._keep_profile:
                    shutil.rmtree(self._profile, ignore_errors=True)

    def _build_launch_cmdline(self) -> t.List[str]:
        raise NotImplementedError

    def _build_launch_env(self):
        env = os.environ.copy()
        if os.name == 'posix':
            if self._timezone is not None:
                env['TZ'] = self._timezone
            if self._locale is not None:
                env['LANGUAGE'] = self._locale
        return env

    def _configure_profile(self):
        pass

    def __del__(self):
        if self._process is not None:
            warnings.warn('A BrowserLauncher instance has not closed with .kill(), it will leak')


class ChromeLauncher(BrowserLauncher):

    def _build_launch_cmdline(self) -> t.List[str]:
        cmd = [
            self._binary,
            f'--window-size={self._window_width},{self._window_height}' if self._window_width is not None and self._window_height is not None else '--start-maximized'
        ]
        if os.name == 'posix':
            cmd.append('--enable-logging')
            cmd.append('--v=2')
        if self._headless:
            cmd.append('--headless')
            cmd.append('--disable-gpu')
        if self._proxy is not None:
            cmd.append(f'--proxy-server={self._proxy}')
        if len(self._extensions) > 0:
            cmd.append(f"--load-extension={','.join(str(path) for path in self._extensions)}")
        if os.name == 'nt' and self._locale is not None:
            cmd.append(f'--lang={self._locale}')
        if self._args is not None:
            cmd.extend(self._args)
        if self._initial_url is not None:
            cmd.append(self._initial_url)
        return cmd