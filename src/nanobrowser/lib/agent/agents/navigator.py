"""
Navigator agent executes the navigation plan step by step, using tools to interact with the browser
"""
import logging
from copy import deepcopy
from typing import Dict, Optional, Any
from pydantic import BaseModel, Field
from langchain_core.messages import ToolMessage
from .base import BaseAgentOptions, BaseAgent, AgentOutput
from ..prompts.navigator import NavigatorPrompt
from ..tools import click, enter_text_and_click, entertext, bulk_enter_text, get_dom_with_content_type, openurl, press_key_combination, extract_text_from_pdf
from ..event.base import ExecutionState, EventData

logger = logging.getLogger(__name__)

class NavigatorResult(BaseModel):
    """
    Result of the navigator agent
    """
    final_response: str = Field(
        description="The final response or conclusion after navigation"
    )

class NavigatorAgent(BaseAgent):
    def __init__(self, options: BaseAgentOptions):
        super().__init__(options)

        # make sure prompt is set
        if options.prompt is None:
            self.prompt = NavigatorPrompt()
        
        # register default browser tools
        self._register_default_tools()

    def _register_default_tools(self):
        self.register_tool(click)
        self.register_tool(enter_text_and_click)
        self.register_tool(entertext)
        self.register_tool(bulk_enter_text)
        self.register_tool(get_dom_with_content_type)
        self.register_tool(openurl)
        self.register_tool(press_key_combination)
        self.register_tool(extract_text_from_pdf)

    async def process_request(
        self,
        user_input: str,
        additional_params: Optional[Dict[str, Any]] = None
    ) -> AgentOutput:
        self.context.step += 1
        self.context.tool_round = 0

        # clear message history at the beginning of every request
        self.message_history.clear()
        self.message_history.add_message(self.build_system_message())

        # emit step started event
        await self.emit_event(ExecutionState.STEP_START, EventData(
                task_id=self.context.task_id,
                step=self.context.step, 
                details=user_input
            )
        )

        # get current page info
        page_info = await self.context.browser_context.get_current_page_info()
        user_message = self.build_user_message(user_input, url=page_info.url, title=page_info.title)
        logger.debug(f"Navigator user message: {user_message}")

        self.message_history.add_message(user_message)

        tools_to_use = []
        for _, tool_func in self.tools.items():
            tools_to_use.append(tool_func)

        allowed_tool_rounds = self.context.max_tool_rounds
        event_data = EventData(
                task_id=self.context.task_id,
                step=self.context.step,
            )
        
        try:
            tool_calls = []
            final_message = ''

            while allowed_tool_rounds > 0 and not self.context.stop_task_now: 
                llm_with_tools = self.chatLLM.bind_tools(tools_to_use)
                ai_response = await llm_with_tools.ainvoke(self.message_history.get_messages())    
                self.message_history.add_message(ai_response)

                if ai_response.tool_calls:
                    self.context.tool_round += 1
                    event_data.tool_round = self.context.tool_round

                    # execute tool calls and return tool messages back to the LLM
                    for tool_call in ai_response.tool_calls:
                        if self.context.stop_task_now:
                            break

                        tool_name = tool_call["name"].lower()
                        tool_args = tool_call["args"]
                        selected_tool = self.tools[tool_name]
                        logger.debug(f"Invoking tool: {selected_tool.name} with args: {tool_args}")

                        # inject context into tool call
                        tool_call_copy = deepcopy(tool_call)
                        tool_call_copy["args"]["context"] = self.context

                        tool_response = await selected_tool.ainvoke(tool_call_copy)
                        tool_msg = ToolMessage(
                            tool_call_id=tool_call["id"],
                            content=tool_response,
                        )
                        # return the tool message to the LLM
                        self.message_history.add_message(tool_msg)
                        # record the tool call
                        tool_calls.append(tool_call_copy)

                    # Also send current page info to the LLM
                    page_info = await self.context.browser_context.get_current_page_info()
                    user_message = self.build_user_message(
                        """
                        Please analyze the results of the above tool calls and current web page info, check if the sub-task is complete.
                        - If yes, return the final response.
                        - If no, return the next tool call.
                        """,
                        url=page_info.url, 
                        title=page_info.title
                    )
                    self.message_history.add_message(user_message)

                else:
                    # remove the termination message from the response to avoid confusion
                    final_message = ai_response.content.replace("##TERMINATE TASK##", "")
                    event_data.final = True
                    break

                allowed_tool_rounds -= 1

            if self.context.stop_task_now:
                return AgentOutput(
                    intent=user_input,
                    result=None,
                    error="Task cancelled"
                )

            if allowed_tool_rounds == 0:
                # emit event
                self.context.error += 1
                error_msg = "too many rounds of tool calls in subtask"
                event_data.details = error_msg
                await self.emit_event(ExecutionState.STEP_FAIL, event_data)
                return AgentOutput(
                    intent=user_input,
                    tool_calls=tool_calls,
                    result= None,
                    error=error_msg
                )
            
            # emit event
            event_data.details = final_message
            await self.emit_event(ExecutionState.STEP_OK, event_data)

            return AgentOutput(
                intent=user_input,
                tool_calls=tool_calls,
                result=NavigatorResult(final_response=final_message),
                error=None
            )
        
        except Exception as e:
            self.context.error += 1
            error_msg = str(e)
            # emit event
            event_data.details = error_msg
            await self.emit_event(ExecutionState.STEP_FAIL, event_data)

            logger.error(f"Error parsing navigator response: {e}")
            return AgentOutput(
                intent=user_input,
                result=None,
                error=error_msg
            )
        



