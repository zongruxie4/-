import os
import platform
import yaml
from dotenv import load_dotenv
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional, Dict, Any
from .logging_config import configure_logging

load_dotenv()

@dataclass
class AgentConfig:
    model: str
    model_provider: str
    api_key: Optional[str] = None
    inference_config: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self):
        # Set api_key to None if it starts with "sk-..."
        if isinstance(self.api_key, str) and self.api_key.startswith("sk-"):
            self.api_key = None

        # Move any unknown parameters to inference_config during initialization
        known_fields = {'model', 'model_provider', 'api_key', 'inference_config'}
        for k, v in list(self.__dict__.items()):
            if k not in known_fields and not k.startswith('_'):
                self.inference_config[k] = v
                delattr(self, k)

@dataclass
class BrowserConfig:
    chrome_app_path: Optional[str] = None
    cdp_port: int = 9222

@dataclass
class ServerConfig:
    host: str = "127.0.0.1"
    port: int = 6768

@dataclass
class NanoConfig:
    base_dir: Path
    save_chat_history: bool = True
    log_events: bool = True
    max_steps: int = 100
    max_errors: int = 20
    max_tool_rounds: int = 20
    planner: AgentConfig = None
    navigator: AgentConfig = None
    browser: BrowserConfig = None
    server: ServerConfig = None
    log_level: str = "INFO"

    @staticmethod
    def try_to_find_chrome_path() -> Optional[str]:
        """
        Tries to find the Chrome executable path based on the operating system.
        Returns None if Chrome is not found.
        """
        system = platform.system()
        
        if system == "Darwin":  # macOS
            chrome_paths = [
                "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
                "~/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
            ]
            for path in chrome_paths:
                path = os.path.expanduser(path)
                if os.path.exists(path):
                    return path
                    
        elif system == "Windows":
            chrome_paths = [
                os.path.join(os.environ.get("PROGRAMFILES", ""), "Google/Chrome/Application/chrome.exe"),
                os.path.join(os.environ.get("PROGRAMFILES(X86)", ""), "Google/Chrome/Application/chrome.exe"),
                os.path.join(os.environ.get("LOCALAPPDATA", ""), "Google/Chrome/Application/chrome.exe")
            ]
            for path in chrome_paths:
                if os.path.exists(path):
                    return path
                    
        return None

    @classmethod
    def from_yaml(cls, yaml_path: str | Path) -> 'NanoConfig':
        with open(yaml_path, 'r') as f:
            config_dict = yaml.safe_load(f)
        
        # Configure logging first
        configure_logging(level=config_dict.get('log_level', 'INFO'))
        
        base_dir = config_dict.get('base_dir', Path.cwd()/".nanobrowser")
        config_dict['base_dir'] = Path(base_dir)
        
        # Create LLM configs
        if 'planner' in config_dict:
            config_dict['planner'] = AgentConfig(**config_dict['planner'])
        if 'navigator' in config_dict:
            config_dict['navigator'] = AgentConfig(**config_dict['navigator'])
            
        if 'browser' in config_dict:
            chrome_path = None
            if config_dict['browser']['chrome_app_path']:
                chrome_path = config_dict['browser']['chrome_app_path'].strip()
                if not os.path.exists(chrome_path):
                    chrome_path = None
            if not chrome_path:
                chrome_path = cls.try_to_find_chrome_path()

            if chrome_path:
                config_dict['browser']['chrome_app_path'] = chrome_path

            config_dict['browser'] = BrowserConfig(**config_dict['browser'])
        else:
            # try to find chrome path
            chrome_path = cls.try_to_find_chrome_path()
            if chrome_path:
                config_dict['browser'] = BrowserConfig(chrome_app_path=chrome_path)
            else:
                config_dict['browser'] = None
            
        # Add WebSocket server config handling
        if 'server' in config_dict:
            config_dict['server'] = ServerConfig(**config_dict['server'])
        
        return cls(**config_dict) 