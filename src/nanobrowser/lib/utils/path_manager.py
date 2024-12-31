from pathlib import Path
from typing import Dict

class PathManager:
    """
    A singleton class to manage paths for the agents.
    """
    _instance = None

    def __new__(cls, *args, **kwargs): # type: ignore
        if cls._instance is None:
            cls._instance = super(PathManager, cls).__new__(cls)
        return cls._instance

    def __init__(self, base_dir: Path | str = None):
        # Convert string to Path if necessary
        if isinstance(base_dir, str):
            base_dir = Path(base_dir)
        
        self.base = base_dir or Path.home() / ".r2"
        
        # Define subdirectories
        self.logs = self.base / "logs"
        self.screenshots = self.base / "screenshots"
        self.messages = self.base / "messages"
        self.tasks = self.base / "tasks"
        self.outputs = self.base / "outputs"
        self.temp = self.base / "temp"
        
        # Create directories if they don't exist
        self._create_directories()
    
    def _create_directories(self):
        """Create all required directories if they don't exist."""
        directories = [
            self.base,
            self.logs,
            self.screenshots,
            self.messages,
            self.tasks,
            self.outputs,
            self.temp
        ]
        
        for directory in directories:
            directory.mkdir(parents=True, exist_ok=True)
    
    @property
    def paths(self) -> Dict[str, Path]:
        """Return a dictionary of all available paths."""
        return {
            "logs": self.logs,
            "screenshots": self.screenshots,
            "messages": self.messages,
            "tasks": self.tasks,
            "outputs": self.outputs,
            "temp": self.temp,
            "base": self.base
        } 