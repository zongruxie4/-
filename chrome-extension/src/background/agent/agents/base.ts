import type { z } from 'zod';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { AgentContext, AgentOutput } from '../types';
import type { BasePrompt } from '../prompts/base';
import type { BaseMessage } from '@langchain/core/messages';
import { createLogger } from '@src/background/log';
import type { Action } from '../actions/builder';
import { convertInputMessages, extractJsonFromModelOutput, removeThinkTags } from '../messages/utils';
import { isAbortedError, RequestCancelledError } from './errors';
import { ProviderTypeEnum } from '@extension/storage';

const logger = createLogger('agent');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CallOptions = Record<string, any>;

// Update options to use Zod schema
export interface BaseAgentOptions {
  chatLLM: BaseChatModel;
  context: AgentContext;
  prompt: BasePrompt;
  provider?: string;
}
export interface ExtraAgentOptions {
  id?: string;
  toolCallingMethod?: string;
  callOptions?: CallOptions;
}

/**
 * Base class for all agents
 * @param T - The Zod schema for the model output
 * @param M - The type of the result field of the agent output
 */
export abstract class BaseAgent<T extends z.ZodType, M = unknown> {
  protected id: string;
  protected chatLLM: BaseChatModel;
  protected prompt: BasePrompt;
  protected context: AgentContext;
  protected actions: Record<string, Action> = {};
  protected modelOutputSchema: T;
  protected toolCallingMethod: string | null;
  protected chatModelLibrary: string;
  protected modelName: string;
  protected provider: string;
  protected withStructuredOutput: boolean;
  protected callOptions?: CallOptions;
  protected modelOutputToolName: string;
  declare ModelOutput: z.infer<T>;

  constructor(modelOutputSchema: T, options: BaseAgentOptions, extraOptions?: Partial<ExtraAgentOptions>) {
    // base options
    this.modelOutputSchema = modelOutputSchema;
    this.chatLLM = options.chatLLM;
    this.prompt = options.prompt;
    this.context = options.context;
    this.provider = options.provider || '';
    // TODO: fix this, the name is not correct in production environment
    this.chatModelLibrary = this.chatLLM.constructor.name;
    this.modelName = this.getModelName();
    this.withStructuredOutput = this.setWithStructuredOutput();
    // extra options
    this.id = extraOptions?.id || 'agent';
    this.toolCallingMethod = this.setToolCallingMethod(extraOptions?.toolCallingMethod);
    this.callOptions = extraOptions?.callOptions;
    this.modelOutputToolName = `${this.id}_output`;
  }

  // Set the model name
  private getModelName(): string {
    if ('modelName' in this.chatLLM) {
      return this.chatLLM.modelName as string;
    }
    if ('model_name' in this.chatLLM) {
      return this.chatLLM.model_name as string;
    }
    if ('model' in this.chatLLM) {
      return this.chatLLM.model as string;
    }
    return 'Unknown';
  }

  // Set the tool calling method
  private setToolCallingMethod(toolCallingMethod?: string): string | null {
    if (toolCallingMethod === 'auto') {
      switch (this.chatModelLibrary) {
        case 'ChatGoogleGenerativeAI':
          return null;
        case 'ChatOpenAI':
        case 'AzureChatOpenAI':
        case 'ChatGroq':
        case 'ChatXAI':
          return 'function_calling';
        default:
          return null;
      }
    }
    return toolCallingMethod || null;
  }

  // Detect provider from model name for compatibility
  private detectProviderFromModelName(modelName: string): string {
    // Llama models - updated to match actual API model names
    if (modelName.includes('Llama-4') || modelName.includes('Llama-3.3') || modelName.includes('llama-3.3')) {
      return ProviderTypeEnum.Llama;
    }

    // DeepSeek models
    if (modelName.includes('deepseek')) {
      return ProviderTypeEnum.DeepSeek;
    }

    // OpenAI models
    if (modelName.includes('gpt-') || modelName.includes('o3') || modelName.includes('o4')) {
      return ProviderTypeEnum.OpenAI;
    }

    // Anthropic models
    if (modelName.includes('claude')) {
      return ProviderTypeEnum.Anthropic;
    }

    // Gemini models
    if (modelName.includes('gemini')) {
      return ProviderTypeEnum.Gemini;
    }

    // Grok models
    if (modelName.includes('grok')) {
      return ProviderTypeEnum.Grok;
    }

    // Default fallback
    return 'unknown';
  }

  // Set whether to use structured output based on the model name
  private setWithStructuredOutput(): boolean {
    // Use provider from options if available, otherwise detect from model name
    const effectiveProvider = this.provider || this.detectProviderFromModelName(this.modelName);
    console.log(`[setWithStructuredOutput] Checking model: ${this.modelName}, provider: ${effectiveProvider}`);

    if (this.modelName === 'deepseek-reasoner' || this.modelName === 'deepseek-r1') {
      console.log(`[${this.modelName}] DeepSeek reasoner model detected, disabling structured output`);
      return false;
    }

    // Llama API models don't support json_schema response format
    if (effectiveProvider === ProviderTypeEnum.Llama) {
      console.log(`[${this.modelName}] Llama API doesn't support structured output, using manual JSON extraction`);
      logger.debug(`[${this.modelName}] Llama API doesn't support structured output, using manual JSON extraction`);
      return false;
    }

    console.log(`[${this.modelName}] Using structured output for provider: ${effectiveProvider}`);
    return true;
  }

  async invoke(inputMessages: BaseMessage[]): Promise<this['ModelOutput']> {
    // Use structured output
    if (this.withStructuredOutput) {
      logger.debug(`[${this.modelName}] Preparing structured output call with schema:`, {
        schemaName: this.modelOutputToolName,
        messageCount: inputMessages.length,
        modelProvider: this.provider,
      });

      const structuredLlm = this.chatLLM.withStructuredOutput(this.modelOutputSchema, {
        includeRaw: true,
        name: this.modelOutputToolName,
      });

      try {
        logger.debug(`[${this.modelName}] Invoking LLM with structured output...`);
        const response = await structuredLlm.invoke(inputMessages, {
          signal: this.context.controller.signal,
          ...this.callOptions,
        });

        logger.debug(`[${this.modelName}] LLM response received:`, {
          hasParsed: !!response.parsed,
          hasRaw: !!response.raw,
          rawContent: response.raw?.content?.slice(0, 500) + (response.raw?.content?.length > 500 ? '...' : ''),
        });

        if (response.parsed) {
          logger.debug(`[${this.modelName}] Successfully parsed structured output`);
          return response.parsed;
        }
        logger.error('Failed to parse response', response);
        throw new Error('Could not parse response with structured output');
      } catch (error) {
        if (isAbortedError(error)) {
          throw error;
        }
        logger.error(`[${this.modelName}] LLM call failed with error:`, error);
        const errorMessage = `Failed to invoke ${this.modelName} with structured output: ${error}`;
        throw new Error(errorMessage);
      }
    }

    // Without structured output support, need to extract JSON from model output manually
    console.log(`[${this.modelName}] Using manual JSON extraction fallback method`);
    logger.debug(`[${this.modelName}] Using manual JSON extraction fallback method`);
    const convertedInputMessages = convertInputMessages(inputMessages, this.modelName);

    try {
      console.log(`[${this.modelName}] Invoking LLM without structured output...`);
      logger.debug(`[${this.modelName}] Invoking LLM without structured output...`);
      const response = await this.chatLLM.invoke(convertedInputMessages, {
        signal: this.context.controller.signal,
        ...this.callOptions,
      });

      console.log(`[${this.modelName}] LLM response received for manual extraction:`, {
        contentType: typeof response.content,
        contentLength: typeof response.content === 'string' ? response.content.length : 0,
        contentPreview:
          typeof response.content === 'string'
            ? response.content.slice(0, 500) + (response.content.length > 500 ? '...' : '')
            : response.content,
        fullResponse: response,
        responseKeys: Object.keys(response || {}),
      });
      logger.debug(`[${this.modelName}] LLM response received for manual extraction:`, {
        contentType: typeof response.content,
        contentLength: typeof response.content === 'string' ? response.content.length : 0,
        contentPreview:
          typeof response.content === 'string'
            ? response.content.slice(0, 500) + (response.content.length > 500 ? '...' : '')
            : response.content,
      });

      if (typeof response.content === 'string') {
        response.content = removeThinkTags(response.content);
        try {
          console.log(`[${this.modelName}] Extracting JSON from response content...`);
          logger.debug(`[${this.modelName}] Extracting JSON from response content...`);
          const extractedJson = extractJsonFromModelOutput(response.content);
          console.log(`[${this.modelName}] Extracted JSON:`, extractedJson);
          logger.debug(`[${this.modelName}] Extracted JSON:`, extractedJson);

          const parsed = this.validateModelOutput(extractedJson);
          if (parsed) {
            console.log(`[${this.modelName}] Successfully validated and parsed manual JSON extraction`);
            logger.debug(`[${this.modelName}] Successfully validated and parsed manual JSON extraction`);
            return parsed;
          }
        } catch (error) {
          logger.error(`[${this.modelName}] Failed to extract JSON from response:`, error);
          const errorMessage = `Failed to extract JSON from response: ${error}`;
          throw new Error(errorMessage);
        }
      }
    } catch (error) {
      logger.error(`[${this.modelName}] LLM call failed in manual extraction mode:`, error);
      throw error;
    }
    const errorMessage = `Failed to parse response: ${response}`;
    logger.error(errorMessage);
    throw new Error('Could not parse response');
  }

  // Execute the agent and return the result
  abstract execute(): Promise<AgentOutput<M>>;

  // Helper method to validate metadata
  protected validateModelOutput(data: unknown): this['ModelOutput'] | undefined {
    if (!this.modelOutputSchema || !data) return undefined;
    try {
      return this.modelOutputSchema.parse(data);
    } catch (error) {
      logger.error('validateModelOutput', error);
      throw new Error('Could not validate model output');
    }
  }
}
