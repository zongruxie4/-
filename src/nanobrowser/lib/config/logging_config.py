import logging

def configure_logging(
    level: str = "INFO",
    format: str = '[%(asctime)s] %(levelname)s {%(filename)s:%(lineno)d} - %(message)s',
    date_format: str = '%Y-%m-%d %H:%M:%S'
) -> None:
    """Configure root logger with common settings"""
    # Configure root logger
    logging.basicConfig(
        level=level.upper(),
        format=format,
        datefmt=date_format
    )
    
    # Suppress noisy modules
    suppress_modules = [
        "httpcore",
        "httpx",
        "playwright",
        "urllib3",
        "asyncio",
        "websockets",
        "langchain",
        "openai",
        "anthropic",
        "langchain_openai",
        "langchain_anthropic",
    ]
    
    for module in suppress_modules:
        module_logger = logging.getLogger(module)
        module_logger.setLevel(logging.WARNING)
        module_logger.propagate = False