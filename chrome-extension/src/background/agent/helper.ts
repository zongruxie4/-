import { type ProviderConfig, AgentNameEnum, OLLAMA_PROVIDER } from '@extension/storage';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatOllama } from '@langchain/ollama';

// Provider constants
const OPENAI_PROVIDER = 'openai';
const ANTHROPIC_PROVIDER = 'anthropic';
const GEMINI_PROVIDER = 'gemini';

// create a chat model based on the agent name, the model name and provider
export function createChatModel(
  agentName: string,
  providerName: string,
  providerConfig: ProviderConfig,
  modelName: string,
): BaseChatModel {
  const maxTokens = 2000;
  const maxCompletionTokens = 5000;
  let temperature = 0;
  let topP = 0.001;

  console.log('providerName', providerName);
  console.log('providerConfig', providerConfig);

  switch (providerName) {
    case OPENAI_PROVIDER: {
      if (agentName === AgentNameEnum.Planner) {
        temperature = 0.02;
      }
      const args: {
        model: string;
        apiKey: string;
        configuration: Record<string, unknown>;
        modelKwargs?: { max_completion_tokens: number };
        topP?: number;
        temperature?: number;
        maxTokens?: number;
      } = {
        model: modelName,
        apiKey: providerConfig.apiKey,
        configuration: {},
      };
      if (providerConfig.baseUrl) {
        args.configuration = {
          baseURL: providerConfig.baseUrl,
        };
      }

      // O series models have different parameters
      if (modelName.startsWith('o')) {
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
    case ANTHROPIC_PROVIDER: {
      temperature = 0.1;
      topP = 0.1;
      const args = {
        model: modelName,
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
    case GEMINI_PROVIDER: {
      temperature = 0.5;
      topP = 0.8;
      const args = {
        model: modelName,
        apiKey: providerConfig.apiKey,
        temperature,
        topP,
      };
      return new ChatGoogleGenerativeAI(args);
    }
    case OLLAMA_PROVIDER: {
      if (agentName === AgentNameEnum.Planner) {
        temperature = 0.02;
      }
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
        model: modelName,
        apiKey: providerConfig.apiKey,
        baseUrl: providerConfig.baseUrl ?? 'http://localhost:11434',
        options: {
          num_ctx: 128000,
        },
      };

      // O series models have different parameters
      if (modelName.startsWith('o')) {
        args.modelKwargs = {
          max_completion_tokens: maxCompletionTokens,
        };
      } else {
        args.topP = topP;
        args.temperature = temperature;
        args.maxTokens = maxTokens;
      }
      return new ChatOllama(args);
    }
    default: {
      if (agentName === AgentNameEnum.Planner) {
        temperature = 0.02;
      }
      const args: {
        model: string;
        apiKey: string;
        configuration: Record<string, unknown>;
        modelKwargs?: { max_completion_tokens: number };
        topP?: number;
        temperature?: number;
        maxTokens?: number;
      } = {
        model: modelName,
        apiKey: providerConfig.apiKey,
        configuration: {},
      };

      args.configuration = {
        baseURL: providerConfig.baseUrl,
      };

      // O series models have different parameters
      if (modelName.startsWith('o')) {
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
  }
}
