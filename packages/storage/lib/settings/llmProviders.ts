import { StorageEnum } from '../base/enums';
import { createStorage } from '../base/base';
import type { BaseStorage } from '../base/types';
import type { LLMProviderEnum } from './types';

// Interface for a single provider configuration
export interface ProviderConfig {
  apiKey: string;
  baseUrl?: string;
}

// Interface for storing multiple LLM provider configurations
export interface LLMKeyRecord {
  providers: Record<LLMProviderEnum, ProviderConfig>;
}

export type LLMProviderStorage = BaseStorage<LLMKeyRecord> & {
  setProvider: (provider: LLMProviderEnum, config: ProviderConfig) => Promise<void>;
  getProvider: (provider: LLMProviderEnum) => Promise<ProviderConfig | undefined>;
  removeProvider: (provider: LLMProviderEnum) => Promise<void>;
  hasProvider: (provider: LLMProviderEnum) => Promise<boolean>;
  getConfiguredProviders: () => Promise<LLMProviderEnum[]>;
  getAllProviders: () => Promise<Record<LLMProviderEnum, ProviderConfig>>;
};

const storage = createStorage<LLMKeyRecord>(
  'llm-api-keys',
  { providers: {} as Record<LLMProviderEnum, ProviderConfig> },
  {
    storageEnum: StorageEnum.Local,
    liveUpdate: true,
  },
);

export const llmProviderStore: LLMProviderStorage = {
  ...storage,
  async setProvider(provider: LLMProviderEnum, config: ProviderConfig) {
    if (!provider) {
      throw new Error('Provider name cannot be empty');
    }
    if (!config.apiKey) {
      throw new Error('API key cannot be empty');
    }
    const current = (await storage.get()) || { providers: {} };
    await storage.set({
      providers: {
        ...current.providers,
        [provider]: config,
      },
    });
  },
  async getProvider(provider: LLMProviderEnum) {
    const data = (await storage.get()) || { providers: {} };
    return data.providers[provider];
  },
  async removeProvider(provider: LLMProviderEnum) {
    const current = (await storage.get()) || { providers: {} };
    const newProviders = { ...current.providers };
    delete newProviders[provider];
    await storage.set({ providers: newProviders });
  },
  async hasProvider(provider: LLMProviderEnum) {
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
    return Object.keys(data.providers) as LLMProviderEnum[];
  },
  async getAllProviders() {
    const data = await storage.get();
    return data.providers;
  },
};
