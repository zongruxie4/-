from .base import BasePrompt

class ValidatorPrompt(BasePrompt):
    """
    Validator prompt for the agent.

    Not implemented yet.
    """
    def __init__(self):
        self.system_template = """

"""

    def get_system_prompt(self)->str:
        return self.system_template
    
    def build_user_prompt(self, user_input: str)->str:
        return self.user_template.format(user_input=user_input)