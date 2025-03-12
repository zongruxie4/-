import { useEffect, useState } from 'react';
import { Button } from '@extension/ui';
import { llmProviderStore, agentModelStore, AgentNameEnum, llmProviderModelNames } from '@extension/storage';

// Provider constants
const OPENAI_PROVIDER = 'openai';
const ANTHROPIC_PROVIDER = 'anthropic';
const GEMINI_PROVIDER = 'gemini';

export const ModelSettings = () => {
  const [apiKeys, setApiKeys] = useState<Record<string, { apiKey: string; baseUrl?: string }>>(
    {} as Record<string, { apiKey: string; baseUrl?: string }>,
  );
  const [modifiedProviders, setModifiedProviders] = useState<Set<string>>(new Set());
  const [selectedModels, setSelectedModels] = useState<Record<AgentNameEnum, string>>({
    [AgentNameEnum.Navigator]: '',
    [AgentNameEnum.Planner]: '',
    [AgentNameEnum.Validator]: '',
  });

  useEffect(() => {
    const loadApiKeys = async () => {
      try {
        const providers = await llmProviderStore.getConfiguredProviders();

        const keys: Record<string, { apiKey: string; baseUrl?: string }> = {} as Record<
          string,
          { apiKey: string; baseUrl?: string }
        >;

        for (const provider of providers) {
          const config = await llmProviderStore.getProvider(provider);
          console.log('config', config);
          if (config) {
            keys[provider] = {
              apiKey: config.apiKey,
              baseUrl: config.baseUrl,
            };
          }
        }
        setApiKeys(keys);
      } catch (error) {
        console.error('Error loading API keys:', error);
        setApiKeys({} as Record<string, { apiKey: string; baseUrl?: string }>);
      }
    };

    loadApiKeys();
  }, []);

  // Load existing agent models on mount
  useEffect(() => {
    const loadAgentModels = async () => {
      try {
        const models: Record<AgentNameEnum, string> = {
          [AgentNameEnum.Planner]: '',
          [AgentNameEnum.Navigator]: '',
          [AgentNameEnum.Validator]: '',
        };

        for (const agent of Object.values(AgentNameEnum)) {
          const config = await agentModelStore.getAgentModel(agent);
          if (config) {
            models[agent] = config.modelName;
          }
        }
        setSelectedModels(models);
      } catch (error) {
        console.error('Error loading agent models:', error);
      }
    };

    loadAgentModels();
  }, []);

  const handleApiKeyChange = (provider: string, apiKey: string, baseUrl?: string) => {
    setModifiedProviders(prev => new Set(prev).add(provider));
    setApiKeys(prev => ({
      ...prev,
      [provider]: {
        apiKey: apiKey.trim(),
        baseUrl: baseUrl !== undefined ? baseUrl.trim() : prev[provider]?.baseUrl,
      },
    }));
  };

  const handleSave = async (provider: string) => {
    try {
      // The provider store will handle filling in the missing fields
      await llmProviderStore.setProvider(provider, {
        apiKey: apiKeys[provider].apiKey,
        baseUrl: apiKeys[provider].baseUrl,
      });

      setModifiedProviders(prev => {
        const next = new Set(prev);
        next.delete(provider);
        return next;
      });
    } catch (error) {
      console.error('Error saving API key:', error);
    }
  };

  const handleDelete = async (provider: string) => {
    try {
      await llmProviderStore.removeProvider(provider);
      setApiKeys(prev => {
        const next = { ...prev };
        delete next[provider];
        return next;
      });
    } catch (error) {
      console.error('Error deleting API key:', error);
    }
  };

  const getButtonProps = (provider: string) => {
    const hasStoredKey = Boolean(apiKeys[provider]?.apiKey);
    const isModified = modifiedProviders.has(provider);
    const hasInput = Boolean(apiKeys[provider]?.apiKey?.trim());

    if (hasStoredKey && !isModified) {
      return {
        variant: 'danger' as const,
        children: 'Delete',
        disabled: false,
      };
    }

    return {
      variant: 'primary' as const,
      children: 'Save',
      disabled: !hasInput || !isModified,
    };
  };

  const getAvailableModels = () => {
    const models: string[] = [];

    for (const [provider, config] of Object.entries(apiKeys)) {
      if (config.apiKey) {
        const providerModels = llmProviderModelNames[provider as keyof typeof llmProviderModelNames] || [];
        models.push(...providerModels);
      }
    }

    return models.length ? models : [''];
  };

  const handleModelChange = async (agentName: AgentNameEnum, model: string) => {
    setSelectedModels(prev => ({
      ...prev,
      [agentName]: model,
    }));

    try {
      if (model) {
        // Determine provider from model name
        let provider: string | undefined;
        for (const [providerKey, models] of Object.entries(llmProviderModelNames)) {
          if (models.includes(model)) {
            provider = providerKey;
            break;
          }
        }

        if (provider) {
          await agentModelStore.setAgentModel(agentName, {
            provider,
            modelName: model,
          });
        }
      } else {
        // Reset storage if no model is selected
        await agentModelStore.resetAgentModel(agentName);
      }
    } catch (error) {
      console.error('Error saving agent model:', error);
    }
  };

  const renderModelSelect = (agentName: AgentNameEnum) => (
    <div className="flex items-center justify-between">
      <div>
        <h3 className="text-lg font-medium text-gray-700">{agentName.charAt(0).toUpperCase() + agentName.slice(1)}</h3>
        <p className="text-sm font-normal text-gray-500">{getAgentDescription(agentName)}</p>
      </div>
      <select
        className="w-64 px-3 py-2 border rounded-md"
        disabled={getAvailableModels().length <= 1}
        value={selectedModels[agentName] || ''}
        onChange={e => handleModelChange(agentName, e.target.value)}>
        <option key="default" value="">
          Choose model
        </option>
        {getAvailableModels().map(
          model =>
            model && (
              <option key={model} value={model}>
                {model}
              </option>
            ),
        )}
      </select>
    </div>
  );

  const getAgentDescription = (agentName: AgentNameEnum) => {
    switch (agentName) {
      case AgentNameEnum.Navigator:
        return 'Navigates websites and performs actions';
      case AgentNameEnum.Planner:
        return 'Develops and refines strategies to complete tasks';
      case AgentNameEnum.Validator:
        return 'Checks if tasks are completed successfully';
      default:
        return '';
    }
  };

  return (
    <section className="space-y-6">
      {/* API Keys Section */}
      <div className="bg-white rounded-lg p-6 shadow-sm border border-blue-100 text-left">
        <h2 className="text-xl font-semibold mb-4 text-gray-800 text-left">API Keys</h2>
        <div className="space-y-6">
          {/* OpenAI Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-700">OpenAI</h3>
              <Button
                variant={getButtonProps(OPENAI_PROVIDER).variant}
                disabled={getButtonProps(OPENAI_PROVIDER).disabled}
                onClick={() =>
                  apiKeys[OPENAI_PROVIDER]?.apiKey && !modifiedProviders.has(OPENAI_PROVIDER)
                    ? handleDelete(OPENAI_PROVIDER)
                    : handleSave(OPENAI_PROVIDER)
                }>
                {getButtonProps(OPENAI_PROVIDER).children}
              </Button>
            </div>
            <div className="space-y-3">
              <input
                type="password"
                placeholder="OpenAI API key"
                value={apiKeys[OPENAI_PROVIDER]?.apiKey || ''}
                onChange={e => handleApiKeyChange(OPENAI_PROVIDER, e.target.value)}
                className="w-full p-2 rounded-md bg-gray-50 border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-200 outline-none"
              />
              <input
                type="text"
                placeholder="Custom Base URL (Optional)"
                value={apiKeys[OPENAI_PROVIDER]?.baseUrl || ''}
                onChange={e =>
                  handleApiKeyChange(OPENAI_PROVIDER, apiKeys[OPENAI_PROVIDER]?.apiKey || '', e.target.value)
                }
                className="w-full p-2 rounded-md bg-gray-50 border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-200 outline-none"
              />
            </div>
          </div>

          <div className="border-t border-gray-200" />

          {/* Anthropic Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-700">Anthropic</h3>
              <Button
                variant={getButtonProps(ANTHROPIC_PROVIDER).variant}
                disabled={getButtonProps(ANTHROPIC_PROVIDER).disabled}
                onClick={() =>
                  apiKeys[ANTHROPIC_PROVIDER]?.apiKey && !modifiedProviders.has(ANTHROPIC_PROVIDER)
                    ? handleDelete(ANTHROPIC_PROVIDER)
                    : handleSave(ANTHROPIC_PROVIDER)
                }>
                {getButtonProps(ANTHROPIC_PROVIDER).children}
              </Button>
            </div>
            <div className="space-y-3">
              <input
                type="password"
                placeholder="Anthropic API key"
                value={apiKeys[ANTHROPIC_PROVIDER]?.apiKey || ''}
                onChange={e => handleApiKeyChange(ANTHROPIC_PROVIDER, e.target.value)}
                className="w-full p-2 rounded-md bg-gray-50 border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-200 outline-none"
              />
            </div>
          </div>

          <div className="border-t border-gray-200" />

          {/* Gemini Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-700">Gemini</h3>
              <Button
                variant={getButtonProps(GEMINI_PROVIDER).variant}
                disabled={getButtonProps(GEMINI_PROVIDER).disabled}
                onClick={() =>
                  apiKeys[GEMINI_PROVIDER]?.apiKey && !modifiedProviders.has(GEMINI_PROVIDER)
                    ? handleDelete(GEMINI_PROVIDER)
                    : handleSave(GEMINI_PROVIDER)
                }>
                {getButtonProps(GEMINI_PROVIDER).children}
              </Button>
            </div>
            <div className="space-y-3">
              <input
                type="password"
                placeholder="Gemini API key"
                value={apiKeys[GEMINI_PROVIDER]?.apiKey || ''}
                onChange={e => handleApiKeyChange(GEMINI_PROVIDER, e.target.value)}
                className="w-full p-2 rounded-md bg-gray-50 border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-200 outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Updated Agent Models Section */}
      <div className="bg-white rounded-lg p-6 shadow-sm border border-blue-100 text-left">
        <h2 className="text-xl font-semibold mb-4 text-gray-800 text-left">Model Selection</h2>
        <div className="space-y-4">
          {[AgentNameEnum.Planner, AgentNameEnum.Navigator, AgentNameEnum.Validator].map(agentName => (
            <div key={agentName}>{renderModelSelect(agentName)}</div>
          ))}
        </div>
      </div>
    </section>
  );
};
