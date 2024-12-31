from typing import Optional
from ...utils.time_utils import get_current_timestamp_str

class BasePrompt():
 
    def get_system_prompt(self)->str:
        return f"you are a helpful assistant. {self._current_datetime_info()}"

    def build_user_prompt(
            self, 
            user_input: str,
            url: Optional[str] = None, 
            title: Optional[str] = None,
            follow_up: Optional[bool] = False)->str:
        current_page_info = self._current_page_info(url, title)
        if current_page_info:
            return f"{user_input} \n {current_page_info}"
        else:
            return user_input
    
    def _current_datetime_info(self, timezone: Optional[str] = None)->str:
        return f"Current date and time: {get_current_timestamp_str(timezone)}"
    
    def _current_page_info(self, url: Optional[str] = None, title: Optional[str] = None)->str:
        if url is None:
            return ""
            
        info_parts = [f"- URL: {url}"]
        if title:
            info_parts.append(f"- Title: {title}")
            
        return "Current page:\n" + "\n".join(info_parts)