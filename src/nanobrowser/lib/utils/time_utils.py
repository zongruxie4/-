from datetime import datetime
from typing import Optional
import pytz
import time
import random
import logging

logger = logging.getLogger(__name__)

def generate_new_task_id():
    """
    Generate a new task id based on the current timestamp and a random number.
    """
    return f"{int(time.time() * 1000)}-{random.randint(100000, 999999)}"

def get_current_timestamp_str(timezone: Optional[str] = None) -> str:
    """
    Get the current timestamp as a string in the format YYYY-MM-DD HH:MM:SS Z.
    
    Args:
        timezone (str): Timezone name (e.g. 'US/Pacific', 'UTC', 'Asia/Tokyo')
        
    Returns:
        str: Formatted datetime string in the specified timezone or local time
    """
    format = "%Y-%m-%d %H:%M:%S %Z"
    if timezone:
        try:
            tz = pytz.timezone(timezone)
            return datetime.now(tz).strftime(format)
        except pytz.exceptions.UnknownTimeZoneError:
            logger.error(f"Unknown timezone: {timezone}")
            return datetime.now().strftime(format)
    else:
        return datetime.now().strftime(format)