import { StorageEnum } from '../base/enums';
import { createStorage } from '../base/base';
import type { BaseStorage } from '../base/types';
import { llmProviderModelNames, ProviderTypeEnum, OPENAI_PROVIDER, ANTHROPIC_PROVIDER, GEMINI_PROVIDER } from './types';

// Interface for a single provider configuration
export interface ProviderConfig {
  name?: string; // Display name in the options
  type?: ProviderTypeEnum; // Help to decide which LangChain ChatModel package to use
  apiKey: string; // Must be provided, but may be empty for local models
  baseUrl?: string; // Optional base URL if provided
  modelNames?: string[]; // Chosen model names, if not provided use hardcoded names from llmProviderModelNames
}

// Interface for storing multiple LLM provider configurations
export interface LLMKeyRecord {
  providers: Record<string, ProviderConfig>;
}

export type LLMProviderStorage = BaseStorage<LLMKeyRecord> & {
  setProvider: (provider: string, config: ProviderConfig) => Promise<void>;
  getProvider: (provider: string) => Promise<ProviderConfig | undefined>;
  removeProvider: (provider: string) => Promise<void>;
  hasProvider: (provider: string) => Promise<boolean>;
  getConfiguredProviders: () => Promise<string[]>;
  getAllProviders: () => Promise<Record<string, ProviderConfig>>;
};

const storage = createStorage<LLMKeyRecord>(
  'llm-api-keys',
  { providers: {} },
  {
    storageEnum: StorageEnum.Local,
    liveUpdate: true,
  },
);

// Helper function to determine provider type from provider name
function getProviderTypeFromName(provider: string): ProviderTypeEnum {
  switch (provider) {
    case OPENAI_PROVIDER:
      return ProviderTypeEnum.OpenAI;
    case ANTHROPIC_PROVIDER:
      return ProviderTypeEnum.Anthropic;
    case GEMINI_PROVIDER:
      return ProviderTypeEnum.Gemini;
    default:
      return ProviderTypeEnum.CustomOpenAI;
  }
}

// Helper function to get display name from provider name
function getDisplayNameFromProvider(provider: string): string {
  switch (provider) {
    case OPENAI_PROVIDER:
      return 'OpenAI';
    case ANTHROPIC_PROVIDER:
      return 'Anthropic';
    case GEMINI_PROVIDER:
      return 'Gemini';
    default:
      return provider; // Use the provider string as display name for custom providers
  }
}

export const llmProviderStore: LLMProviderStorage = {
  ...storage,
  async setProvider(provider: string, config: ProviderConfig) {
    if (!provider) {
      throw new Error('Provider name cannot be empty');
    }

    if (config.apiKey === undefined) {
      throw new Error('API key must be provided (can be empty for local models)');
    }

    if (!config.modelNames) {
      throw new Error('Model names must be provided');
    }

    // Ensure backward compatibility by filling in missing fields
    const completeConfig: ProviderConfig = {
      ...config,
      name: config.name || getDisplayNameFromProvider(provider),
      type: config.type || getProviderTypeFromName(provider),
      modelNames: config.modelNames,
    };

    const current = (await storage.get()) || { providers: {} };
    await storage.set({
      providers: {
        ...current.providers,
        [provider]: completeConfig,
      },
    });
  },
  async getProvider(provider: string) {
    const data = (await storage.get()) || { providers: {} };
    const config = data.providers[provider];

    // If we have a config but it's missing some fields, fill them in
    if (config) {
      if (!config.name) {
        config.name = getDisplayNameFromProvider(provider);
      }
      if (!config.type) {
        config.type = getProviderTypeFromName(provider);
      }
      if (!config.modelNames) {
        config.modelNames = llmProviderModelNames[provider as keyof typeof llmProviderModelNames] || [];
      }
    }

    return config;
  },
  async removeProvider(provider: string) {
    const current = (await storage.get()) || { providers: {} };
    const newProviders = { ...current.providers };
    delete newProviders[provider];
    await storage.set({ providers: newProviders });
  },
  async hasProvider(provider: string) {
    const data = (await storage.get()) || { providers: {} };
    return provider in data.providers;
  },
  async getConfiguredProviders() {
    console.log('Getting configured providers');
    const data = await storage.get();
    console.log('Raw storage data:', data); // Debug the entire data object

    if (!data || !data.providers) {
      console.log('No data found, returning empty array');
      return [];
    }

    console.log('Configured providers:', data.providers);
    return Object.keys(data.providers);
  },
  async getAllProviders() {
    const data = await storage.get();
    return data.providers;
  },
};
