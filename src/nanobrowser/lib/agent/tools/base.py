from typing import Annotated
from pydantic import BaseModel, Field
from langchain_core.tools import InjectedToolArg
from ..context import AgentContext

# Base arguments schema for tools that require context, used to inject AgentContext into tool actions
class BaseToolArgsWithContextSchema(BaseModel):
    context: Annotated[AgentContext, InjectedToolArg] = Field(description="The context for the agent to interact with the browser, file system, etc.")

    class Config:
        arbitrary_types_allowed = True # AgentContext is a complex custom type