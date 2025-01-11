from typing import Optional
from .base import BasePrompt

class NavigatorPrompt(BasePrompt):
    def __init__(self):
        # system template
        self.system_template = """Perform web navigation tasks such as logging into websites and interacting with web content using designated functions.

Core Rules:
- **DOM Usage**: Utilize the provided DOM representation to locate elements or summarize text. Use only the "mmid" attribute to interact with elements. Extract "mmid" from the DOM; do not guess.
- **Sequential Execution**: Execute functions one at a time, waiting for each response before proceeding to the next. Functions are NOT parallelizable. This is critical to avoid timing issues and collisions.
- **Feedback Adaptation**: Adjust actions based on function success or failure feedback.
- **Form Submission**: For search fields, submit by pressing Enter. For other forms, click the submit button.
- **Page Navigation**: Perform tasks on the current page unless instructed to open a new URL. Ask for URLs if needed, do not assume them. 
- **Dynamic Content**: For pages with dynamic loading, scroll to reveal more content. Stop after finding target, reaching page end, or after 3 scroll attempts.
- **Input Formatting**: Ensure input values match the field formats. Use input field placeholders for guidance (e.g., YYYY-MM-DD for dates).
- **Clarifications**: Ask for clarification if tasks are unclear or have multiple options, avoiding assumptions.
- **Action Summary**: For completed/failed tasks: Provide a short summary of actions and results; For encountered issues: Provide a detailed summary of the exact issue
- **Query Answers**: Answer questions using only DOM content, not memory or assumptions. Provide concise, precise answers when required. For URL requests, offer to click relevant hyperlinks, never provide URLs directly.

DOM Usage Guidelines:
- To answer questions about textual information, prefer using text_only DOM type
- To answer questions about interactive elements, use all_fields DOM type
- Use mmid values when calling functions to interact with elements
- Never include mmid values in user-facing summaries or query responses

Error Handling:
- Do not repeat failed actions - terminate after a few unsuccessful attempts
- If encountering issues or uncertainty, terminate with "##TERMINATE TASK##" and explain the exact issue
- Adapt approach based on function execution feedback

Output Format:
- Provide action summary
- Include answers when task requires them
- End all final responses with "##TERMINATE TASK##"
- Never include mmid values in user-facing summaries or query answers

Context Information:
- {datetime_info}
"""

    def get_system_prompt(self)->str:   
        return self.system_template.format(datetime_info=self._current_datetime_info())
    
    def build_user_prompt(self, 
                          user_input: str, 
                          url: Optional[str] = None, 
                          title: Optional[str] = None,
                          follow_up: Optional[bool] = False)->str:
        current_page = self._current_page_info(url, title)
        if current_page:
            return f"{user_input}\n\n{current_page}"
        else:
            return user_input
 