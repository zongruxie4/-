import { type ProviderConfig, type ModelConfig, ProviderTypeEnum } from '@extension/storage';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatOllama } from '@langchain/ollama';

// create a chat model based on the agent name, the model name and provider
export function createChatModel(providerConfig: ProviderConfig, modelConfig: ModelConfig): BaseChatModel {
  const maxTokens = 1024 * 4;
  const maxCompletionTokens = 1024 * 4;
  const temperature = (modelConfig.parameters?.temperature ?? 0.1) as number;
  const topP = (modelConfig.parameters?.topP ?? 0.1) as number;

  console.log('modelConfig', modelConfig);

  switch (providerConfig.type) {
    case ProviderTypeEnum.OpenAI: {
      const args: {
        model: string;
        apiKey: string;
        modelKwargs?: { max_completion_tokens: number };
        topP?: number;
        temperature?: number;
        maxTokens?: number;
      } = {
        model: modelConfig.modelName,
        apiKey: providerConfig.apiKey,
      };
      // O series models have different parameters
      if (modelConfig.modelName.startsWith('o')) {
        args.modelKwargs = {
          max_completion_tokens: maxCompletionTokens,
        };
      } else {
        args.topP = topP;
        args.temperature = temperature;
        args.maxTokens = maxTokens;
      }
      return new ChatOpenAI(args);
    }
    case ProviderTypeEnum.Anthropic: {
      const args = {
        model: modelConfig.modelName,
        apiKey: providerConfig.apiKey,
        maxTokens,
        temperature,
        topP,
        clientOptions: {},
      };
      if (providerConfig.baseUrl) {
        args.clientOptions = {
          baseURL: providerConfig.baseUrl,
        };
      }
      return new ChatAnthropic(args);
    }
    case ProviderTypeEnum.Gemini: {
      const args = {
        model: modelConfig.modelName,
        apiKey: providerConfig.apiKey,
        temperature,
        topP,
      };
      return new ChatGoogleGenerativeAI(args);
    }
    case ProviderTypeEnum.Ollama: {
      const args: {
        model: string;
        apiKey?: string;
        baseUrl: string;
        modelKwargs?: { max_completion_tokens: number };
        topP?: number;
        temperature?: number;
        maxTokens?: number;
        options: {
          num_ctx: number;
        };
      } = {
        model: modelConfig.modelName,
        apiKey: providerConfig.apiKey,
        baseUrl: providerConfig.baseUrl ?? 'http://localhost:11434',
        topP,
        temperature,
        maxTokens,
        options: {
          num_ctx: 128000,
        },
      };
      return new ChatOllama(args);
    }
    default: {
      const args: {
        model: string;
        apiKey: string;
        configuration: Record<string, unknown>;
        topP?: number;
        temperature?: number;
        maxTokens?: number;
      } = {
        model: modelConfig.modelName,
        apiKey: providerConfig.apiKey,
        configuration: {
          baseURL: providerConfig.baseUrl,
        },
        topP,
        temperature,
        maxTokens,
      };
      return new ChatOpenAI(args);
    }
  }
}
