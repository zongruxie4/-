import { useEffect, useState, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { Button } from '@extension/ui';
import {
  llmProviderStore,
  agentModelStore,
  AgentNameEnum,
  llmProviderModelNames,
  ProviderTypeEnum,
  OPENAI_PROVIDER,
  ANTHROPIC_PROVIDER,
  GEMINI_PROVIDER,
  OLLAMA_PROVIDER,
  llmProviderParameters,
} from '@extension/storage';

export const ModelSettings = () => {
  const [providers, setProviders] = useState<
    Record<
      string,
      {
        apiKey: string;
        baseUrl?: string;
        name?: string;
        modelNames?: string[];
        type?: ProviderTypeEnum;
        createdAt?: number;
      }
    >
  >({});
  const [modifiedProviders, setModifiedProviders] = useState<Set<string>>(new Set());
  const [providersFromStorage, setProvidersFromStorage] = useState<Set<string>>(new Set());
  const [selectedModels, setSelectedModels] = useState<Record<AgentNameEnum, string>>({
    [AgentNameEnum.Navigator]: '',
    [AgentNameEnum.Planner]: '',
    [AgentNameEnum.Validator]: '',
  });
  const [modelParameters, setModelParameters] = useState<Record<AgentNameEnum, { temperature: number; topP: number }>>({
    [AgentNameEnum.Navigator]: { temperature: 0, topP: 0 },
    [AgentNameEnum.Planner]: { temperature: 0, topP: 0 },
    [AgentNameEnum.Validator]: { temperature: 0, topP: 0 },
  });
  const [newModelInputs, setNewModelInputs] = useState<Record<string, string>>({});
  const [isProviderSelectorOpen, setIsProviderSelectorOpen] = useState(false);
  const newlyAddedProviderRef = useRef<string | null>(null);
  const [nameErrors, setNameErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const loadProviders = async () => {
      try {
        const allProviders = await llmProviderStore.getAllProviders();
        console.log('allProviders', allProviders);

        // Track which providers are from storage
        const fromStorage = new Set(Object.keys(allProviders));
        setProvidersFromStorage(fromStorage);

        // Only use providers from storage, don't add default ones
        setProviders(allProviders);
      } catch (error) {
        console.error('Error loading providers:', error);
        // Set empty providers on error
        setProviders({});
        // No providers from storage on error
        setProvidersFromStorage(new Set());
      }
    };

    loadProviders();
  }, []);

  // Load existing agent models and parameters on mount
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
            if (config.parameters?.temperature !== undefined || config.parameters?.topP !== undefined) {
              setModelParameters(prev => ({
                ...prev,
                [agent]: {
                  temperature: config.parameters?.temperature ?? prev[agent].temperature,
                  topP: config.parameters?.topP ?? prev[agent].topP,
                },
              }));
            }
          }
        }
        setSelectedModels(models);
      } catch (error) {
        console.error('Error loading agent models:', error);
      }
    };

    loadAgentModels();
  }, []);

  // Auto-focus the input field when a new provider is added
  useEffect(() => {
    // Only focus if we have a newly added provider reference
    if (newlyAddedProviderRef.current && providers[newlyAddedProviderRef.current]) {
      const providerId = newlyAddedProviderRef.current;
      const config = providers[providerId];

      // For custom providers, focus on the name input
      if (config.type === ProviderTypeEnum.CustomOpenAI) {
        const nameInput = document.getElementById(`${providerId}-name`);
        if (nameInput) {
          nameInput.focus();
        }
      } else {
        // For default providers, focus on the API key input
        const apiKeyInput = document.getElementById(`${providerId}-api-key`);
        if (apiKeyInput) {
          apiKeyInput.focus();
        }
      }

      // Clear the ref after focusing
      newlyAddedProviderRef.current = null;
    }
  }, [providers]);

  // Add a click outside handler to close the dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (isProviderSelectorOpen && !target.closest('.provider-selector-container')) {
        setIsProviderSelectorOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isProviderSelectorOpen]);

  const handleApiKeyChange = (provider: string, apiKey: string, baseUrl?: string) => {
    setModifiedProviders(prev => new Set(prev).add(provider));
    setProviders(prev => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        apiKey: apiKey.trim(),
        baseUrl: baseUrl !== undefined ? baseUrl.trim() : prev[provider]?.baseUrl,
      },
    }));
  };

  const handleNameChange = (provider: string, name: string) => {
    console.log('handleNameChange called with:', provider, name);

    setModifiedProviders(prev => new Set(prev).add(provider));
    setProviders(prev => {
      const updated = {
        ...prev,
        [provider]: {
          ...prev[provider],
          name: name.trim(),
        },
      };
      console.log('Updated providers state:', updated);
      return updated;
    });
  };

  const handleModelsChange = (provider: string, modelsString: string) => {
    setNewModelInputs(prev => ({
      ...prev,
      [provider]: modelsString,
    }));
  };

  const addModel = (provider: string, model: string) => {
    if (!model.trim()) return;

    setModifiedProviders(prev => new Set(prev).add(provider));
    setProviders(prev => {
      const providerData = prev[provider] || {};

      // Get current models - either from provider config or default models
      let currentModels = providerData.modelNames;
      if (currentModels === undefined) {
        currentModels = [...(llmProviderModelNames[provider as keyof typeof llmProviderModelNames] || [])];
      }

      // Don't add duplicates
      if (currentModels.includes(model.trim())) return prev;

      return {
        ...prev,
        [provider]: {
          ...providerData,
          modelNames: [...currentModels, model.trim()],
        },
      };
    });

    // Clear the input
    setNewModelInputs(prev => ({
      ...prev,
      [provider]: '',
    }));
  };

  const removeModel = (provider: string, modelToRemove: string) => {
    setModifiedProviders(prev => new Set(prev).add(provider));

    setProviders(prev => {
      const providerData = prev[provider] || {};

      // If modelNames doesn't exist in the provider data yet, we need to initialize it
      // with the default models from llmProviderModelNames first
      if (!providerData.modelNames) {
        const defaultModels = llmProviderModelNames[provider as keyof typeof llmProviderModelNames] || [];
        const filteredModels = defaultModels.filter(model => model !== modelToRemove);

        return {
          ...prev,
          [provider]: {
            ...providerData,
            modelNames: filteredModels,
          },
        };
      }

      // If modelNames already exists, just filter out the model to remove
      return {
        ...prev,
        [provider]: {
          ...providerData,
          modelNames: providerData.modelNames.filter(model => model !== modelToRemove),
        },
      };
    });
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, provider: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const value = newModelInputs[provider] || '';
      addModel(provider, value);
    }
  };

  const handleSave = async (provider: string) => {
    try {
      // Check if name contains spaces for custom providers
      if (providers[provider].type === ProviderTypeEnum.CustomOpenAI && providers[provider].name?.includes(' ')) {
        setNameErrors(prev => ({
          ...prev,
          [provider]: 'Spaces are not allowed in provider names. Please use underscores or other characters instead.',
        }));
        return;
      }

      // Check if base URL is required but missing for custom_openai
      if (
        providers[provider].type === ProviderTypeEnum.CustomOpenAI &&
        (!providers[provider].baseUrl || !providers[provider].baseUrl.trim())
      ) {
        alert('Base URL is required for custom OpenAI providers');
        return;
      }

      // Ensure modelNames is provided
      let modelNames = providers[provider].modelNames;
      if (!modelNames) {
        // Use default model names if not explicitly set
        modelNames = [...(llmProviderModelNames[provider as keyof typeof llmProviderModelNames] || [])];
      }

      // The provider store will handle filling in the missing fields
      await llmProviderStore.setProvider(provider, {
        apiKey: providers[provider].apiKey,
        baseUrl: providers[provider].baseUrl,
        name: providers[provider].name,
        modelNames: modelNames,
        type: providers[provider].type,
        createdAt: providers[provider].createdAt,
      });

      // Clear any name errors on successful save
      setNameErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[provider];
        return newErrors;
      });

      // Add to providersFromStorage since it's now saved
      setProvidersFromStorage(prev => new Set(prev).add(provider));

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

      // Remove from providersFromStorage
      setProvidersFromStorage(prev => {
        const next = new Set(prev);
        next.delete(provider);
        return next;
      });

      setProviders(prev => {
        const next = { ...prev };
        delete next[provider];
        return next;
      });
    } catch (error) {
      console.error('Error deleting API key:', error);
    }
  };

  const getButtonProps = (provider: string) => {
    const hasStoredKey = Boolean(providers[provider]?.apiKey);
    const isModified = modifiedProviders.has(provider);
    const hasInput = Boolean(providers[provider]?.apiKey?.trim());

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

  const handleCancelProvider = (providerId: string) => {
    // Remove the provider from the state
    setProviders(prev => {
      const next = { ...prev };
      delete next[providerId];
      return next;
    });

    // Remove from modified providers
    setModifiedProviders(prev => {
      const next = new Set(prev);
      next.delete(providerId);
      return next;
    });
  };

  const getAvailableModels = () => {
    const models: Array<{ provider: string; providerName: string; model: string }> = [];

    // Only get models from configured providers
    for (const [provider, config] of Object.entries(providers)) {
      if (config.apiKey) {
        const providerModels =
          config.modelNames || llmProviderModelNames[provider as keyof typeof llmProviderModelNames] || [];
        models.push(
          ...providerModels.map(model => ({
            provider,
            providerName: config.name || provider,
            model,
          })),
        );
      }
    }

    return models;
  };

  const handleModelChange = async (agentName: AgentNameEnum, modelValue: string) => {
    // modelValue will be in format "provider>model"
    const [provider, model] = modelValue.split('>');

    // Set parameters based on provider type
    const newParameters = llmProviderParameters[provider as keyof typeof llmProviderParameters]?.[agentName] || {
      temperature: 0.1,
      topP: 0.1,
    };

    setModelParameters(prev => ({
      ...prev,
      [agentName]: newParameters,
    }));

    setSelectedModels(prev => ({
      ...prev,
      [agentName]: model,
    }));

    try {
      if (model) {
        await agentModelStore.setAgentModel(agentName, {
          provider,
          modelName: model,
          parameters: newParameters,
        });
      } else {
        // Reset storage if no model is selected
        await agentModelStore.resetAgentModel(agentName);
      }
    } catch (error) {
      console.error('Error saving agent model:', error);
    }
  };

  const handleParameterChange = async (agentName: AgentNameEnum, paramName: 'temperature' | 'topP', value: number) => {
    const newParameters = {
      ...modelParameters[agentName],
      [paramName]: value,
    };

    setModelParameters(prev => ({
      ...prev,
      [agentName]: newParameters,
    }));

    // Only update if we have a selected model
    if (selectedModels[agentName]) {
      try {
        // Find provider
        let provider: string | undefined;
        for (const [providerKey, providerConfig] of Object.entries(providers)) {
          const modelNames =
            providerConfig.modelNames || llmProviderModelNames[providerKey as keyof typeof llmProviderModelNames] || [];
          if (modelNames.includes(selectedModels[agentName])) {
            provider = providerKey;
            break;
          }
        }

        if (provider) {
          await agentModelStore.setAgentModel(agentName, {
            provider,
            modelName: selectedModels[agentName],
            parameters: newParameters,
          });
        }
      } catch (error) {
        console.error('Error saving agent parameters:', error);
      }
    }
  };

  const renderModelSelect = (agentName: AgentNameEnum) => (
    <div className="bg-white p-4 rounded-lg border border-gray-200">
      <h3 className="text-lg font-medium text-gray-700 mb-2">
        {agentName.charAt(0).toUpperCase() + agentName.slice(1)}
      </h3>
      <p className="text-sm font-normal text-gray-500 mb-4">{getAgentDescription(agentName)}</p>

      <div className="space-y-4">
        {/* Model Selection */}
        <div className="flex items-center">
          <label htmlFor={`${agentName}-model`} className="w-24 text-sm font-medium text-gray-700">
            Model
          </label>
          <select
            id={`${agentName}-model`}
            className="flex-1 px-3 py-2 border rounded-md"
            disabled={getAvailableModels().length <= 1}
            value={
              selectedModels[agentName]
                ? `${getProviderForModel(selectedModels[agentName])}>${selectedModels[agentName]}`
                : ''
            }
            onChange={e => handleModelChange(agentName, e.target.value)}>
            <option key="default" value="">
              Choose model
            </option>
            {getAvailableModels().map(({ provider, providerName, model }) => (
              <option key={`${provider}>${model}`} value={`${provider}>${model}`}>
                {`${providerName} > ${model}`}
              </option>
            ))}
          </select>
        </div>

        {/* Temperature Slider */}
        <div className="flex items-center">
          <label htmlFor={`${agentName}-temperature`} className="w-24 text-sm font-medium text-gray-700">
            Temperature
          </label>
          <div className="flex-1 flex items-center space-x-2">
            <input
              id={`${agentName}-temperature`}
              type="range"
              min="0"
              max="2"
              step="0.01"
              value={modelParameters[agentName].temperature}
              onChange={e => handleParameterChange(agentName, 'temperature', Number.parseFloat(e.target.value))}
              className="flex-1"
            />
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600 w-12">{modelParameters[agentName].temperature.toFixed(2)}</span>
              <input
                type="number"
                min="0"
                max="2"
                step="0.01"
                value={modelParameters[agentName].temperature}
                onChange={e => {
                  const value = Number.parseFloat(e.target.value);
                  if (!Number.isNaN(value) && value >= 0 && value <= 2) {
                    handleParameterChange(agentName, 'temperature', value);
                  }
                }}
                className="w-20 px-2 py-1 text-sm border rounded-md"
                aria-label={`${agentName} temperature number input`}
              />
            </div>
          </div>
        </div>

        {/* Top P Slider */}
        <div className="flex items-center">
          <label htmlFor={`${agentName}-topP`} className="w-24 text-sm font-medium text-gray-700">
            Top P
          </label>
          <div className="flex-1 flex items-center space-x-2">
            <input
              id={`${agentName}-topP`}
              type="range"
              min="0"
              max="1"
              step="0.001"
              value={modelParameters[agentName].topP}
              onChange={e => handleParameterChange(agentName, 'topP', Number.parseFloat(e.target.value))}
              className="flex-1"
            />
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600 w-12">{modelParameters[agentName].topP.toFixed(3)}</span>
              <input
                type="number"
                min="0"
                max="1"
                step="0.001"
                value={modelParameters[agentName].topP}
                onChange={e => {
                  const value = Number.parseFloat(e.target.value);
                  if (!Number.isNaN(value) && value >= 0 && value <= 1) {
                    handleParameterChange(agentName, 'topP', value);
                  }
                }}
                className="w-20 px-2 py-1 text-sm border rounded-md"
                aria-label={`${agentName} top P number input`}
              />
            </div>
          </div>
        </div>
      </div>
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

  const getMaxCustomProviderNumber = () => {
    let maxNumber = 0;
    for (const providerId of Object.keys(providers)) {
      if (providerId.startsWith('custom_openai_')) {
        const match = providerId.match(/custom_openai_(\d+)/);
        if (match) {
          const number = Number.parseInt(match[1], 10);
          maxNumber = Math.max(maxNumber, number);
        }
      }
    }
    return maxNumber;
  };

  const addCustomProvider = () => {
    const nextNumber = getMaxCustomProviderNumber() + 1;
    const providerId = `custom_openai_${nextNumber}`;

    setProviders(prev => ({
      ...prev,
      [providerId]: {
        apiKey: '',
        name: `CustomProvider${nextNumber}`,
        type: ProviderTypeEnum.CustomOpenAI,
        baseUrl: '',
        modelNames: [],
        createdAt: Date.now(),
      },
    }));

    setModifiedProviders(prev => new Set(prev).add(providerId));

    // Set the newly added provider ref
    newlyAddedProviderRef.current = providerId;

    // Scroll to the newly added provider after render
    setTimeout(() => {
      const providerElement = document.getElementById(`provider-${providerId}`);
      if (providerElement) {
        providerElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  const addDefaultProvider = (provider: string) => {
    // Get the default provider configuration
    let config: {
      apiKey: string;
      name: string;
      type: ProviderTypeEnum;
      modelNames: string[];
      baseUrl?: string;
      createdAt: number;
    };

    switch (provider) {
      case OPENAI_PROVIDER:
        config = {
          apiKey: '',
          name: 'OpenAI',
          type: ProviderTypeEnum.OpenAI,
          modelNames: [...(llmProviderModelNames[OPENAI_PROVIDER] || [])],
          createdAt: Date.now(),
        };
        break;
      case ANTHROPIC_PROVIDER:
        config = {
          apiKey: '',
          name: 'Anthropic',
          type: ProviderTypeEnum.Anthropic,
          modelNames: [...(llmProviderModelNames[ANTHROPIC_PROVIDER] || [])],
          createdAt: Date.now(),
        };
        break;
      case GEMINI_PROVIDER:
        config = {
          apiKey: '',
          name: 'Gemini',
          type: ProviderTypeEnum.Gemini,
          modelNames: [...(llmProviderModelNames[GEMINI_PROVIDER] || [])],
          createdAt: Date.now(),
        };
        break;
      case OLLAMA_PROVIDER:
        config = {
          apiKey: 'ollama',
          name: 'Ollama',
          type: ProviderTypeEnum.Ollama,
          modelNames: [],
          baseUrl: 'http://localhost:11434',
          createdAt: Date.now(),
        };
        break;
      default:
        return;
    }

    // Add the provider to the state
    setProviders(prev => ({
      ...prev,
      [provider]: config,
    }));

    // Mark as modified so it shows up in the UI
    setModifiedProviders(prev => new Set(prev).add(provider));

    // Set the newly added provider ref
    newlyAddedProviderRef.current = provider;

    // Scroll to the newly added provider after render
    setTimeout(() => {
      const providerElement = document.getElementById(`provider-${provider}`);
      if (providerElement) {
        providerElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  // Sort providers to ensure newly added providers appear at the bottom
  const getSortedProviders = () => {
    // Filter providers to only include those from storage and newly added providers
    const filteredProviders = Object.entries(providers).filter(([providerId]) => {
      // Include if it's from storage
      if (providersFromStorage.has(providerId)) {
        return true;
      }

      // Include if it's a newly added provider (has been modified)
      if (modifiedProviders.has(providerId)) {
        return true;
      }

      // Exclude providers that aren't from storage and haven't been modified
      return false;
    });

    // Sort the filtered providers
    return filteredProviders.sort(([keyA, configA], [keyB, configB]) => {
      // First, separate newly added providers from stored providers
      const isNewA = !providersFromStorage.has(keyA) && modifiedProviders.has(keyA);
      const isNewB = !providersFromStorage.has(keyB) && modifiedProviders.has(keyB);

      // If one is new and one is stored, new ones go to the end
      if (isNewA && !isNewB) return 1;
      if (!isNewA && isNewB) return -1;

      // If both are new or both are stored, sort by createdAt
      if (configA.createdAt && configB.createdAt) {
        return configA.createdAt - configB.createdAt; // Sort in ascending order (oldest first)
      }

      // If only one has createdAt, put the one without createdAt at the end
      if (configA.createdAt) return -1;
      if (configB.createdAt) return 1;

      // If neither has createdAt, sort by type and then name
      const isCustomA = configA.type === ProviderTypeEnum.CustomOpenAI;
      const isCustomB = configB.type === ProviderTypeEnum.CustomOpenAI;

      if (isCustomA && !isCustomB) {
        return 1; // Custom providers come after non-custom
      }

      if (!isCustomA && isCustomB) {
        return -1; // Non-custom providers come before custom
      }

      // Sort alphabetically by name within each group
      return (configA.name || keyA).localeCompare(configB.name || keyB);
    });
  };

  const handleProviderSelection = (providerType: string) => {
    // Close the dropdown immediately
    setIsProviderSelectorOpen(false);

    if (providerType === 'custom') {
      addCustomProvider();
      return;
    }

    // Handle default providers
    switch (providerType) {
      case OPENAI_PROVIDER:
      case ANTHROPIC_PROVIDER:
      case GEMINI_PROVIDER:
      case OLLAMA_PROVIDER:
        addDefaultProvider(providerType);
        break;
      default:
        console.error('Unknown provider type:', providerType);
    }
  };

  const getProviderForModel = (modelName: string): string => {
    for (const [provider, config] of Object.entries(providers)) {
      const modelNames =
        config.modelNames || llmProviderModelNames[provider as keyof typeof llmProviderModelNames] || [];
      if (modelNames.includes(modelName)) {
        return provider;
      }
    }
    return '';
  };

  return (
    <section className="space-y-6">
      {/* LLM Providers Section */}
      <div className="bg-white rounded-lg p-6 shadow-sm border border-blue-100 text-left">
        <h2 className="text-xl font-semibold mb-4 text-gray-800 text-left">LLM Providers</h2>
        <div className="space-y-6">
          {getSortedProviders().length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="mb-4">No providers configured yet. Add a provider to get started.</p>
            </div>
          ) : (
            getSortedProviders().map(([providerId, providerConfig]) => (
              <div
                key={providerId}
                id={`provider-${providerId}`}
                className={`space-y-4 ${modifiedProviders.has(providerId) && !providersFromStorage.has(providerId) ? 'bg-blue-50 p-4 rounded-lg border border-blue-100' : ''}`}>
                <div className="flex items-center justify-between">
                  {providerConfig.type === ProviderTypeEnum.CustomOpenAI ? (
                    <button
                      type="button"
                      className="text-lg font-medium text-gray-700 flex items-center cursor-pointer bg-transparent border-0 p-0 text-left"
                      onClick={() => {
                        const nameInput = document.getElementById(`${providerId}-name`);
                        if (nameInput) {
                          nameInput.focus();
                        }
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          const nameInput = document.getElementById(`${providerId}-name`);
                          if (nameInput) {
                            nameInput.focus();
                          }
                        }
                      }}>
                      {(() => {
                        console.log('Provider header name:', providerId, providerConfig.name);
                        return providerConfig.name || providerId;
                      })()}
                      <span className="ml-2 text-xs text-blue-500">(click to edit)</span>
                    </button>
                  ) : (
                    <h3 className="text-lg font-medium text-gray-700">{providerConfig.name || providerId}</h3>
                  )}
                  <div className="flex space-x-2">
                    {/* Show Cancel button for newly added providers */}
                    {modifiedProviders.has(providerId) && !providersFromStorage.has(providerId) && (
                      <Button variant="secondary" onClick={() => handleCancelProvider(providerId)}>
                        Cancel
                      </Button>
                    )}
                    <Button
                      variant={getButtonProps(providerId).variant}
                      disabled={getButtonProps(providerId).disabled}
                      onClick={() =>
                        providers[providerId]?.apiKey && !modifiedProviders.has(providerId)
                          ? handleDelete(providerId)
                          : handleSave(providerId)
                      }>
                      {getButtonProps(providerId).children}
                    </Button>
                  </div>
                </div>

                {/* Show message for newly added providers */}
                {modifiedProviders.has(providerId) && !providersFromStorage.has(providerId) && (
                  <div className="text-sm text-blue-600 mb-2">
                    <p>This provider is newly added. Enter your API key and click Save to configure it.</p>
                  </div>
                )}

                <div className="space-y-3">
                  {/* Name input (only for custom_openai) - moved to top for prominence */}
                  {providerConfig.type === ProviderTypeEnum.CustomOpenAI && (
                    <div className="flex flex-col">
                      <div className="flex items-center">
                        <label htmlFor={`${providerId}-name`} className="w-20 text-sm font-medium text-gray-700">
                          Name
                        </label>
                        <input
                          id={`${providerId}-name`}
                          type="text"
                          placeholder="Provider name"
                          value={providerConfig.name || ''}
                          onChange={e => {
                            console.log('Name input changed:', e.target.value);
                            handleNameChange(providerId, e.target.value);
                          }}
                          className={`flex-1 p-2 rounded-md bg-gray-50 border ${nameErrors[providerId] ? 'border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-200' : 'border-blue-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-200'} outline-none`}
                        />
                      </div>
                      {nameErrors[providerId] ? (
                        <p className="text-xs text-red-500 ml-20 mt-1">{nameErrors[providerId]}</p>
                      ) : (
                        <p className="text-xs text-blue-500 ml-20 mt-1">
                          Provider name (spaces are not allowed when saving)
                        </p>
                      )}
                    </div>
                  )}

                  {/* API Key input with label */}
                  <div className="flex items-center">
                    <label htmlFor={`${providerId}-api-key`} className="w-20 text-sm font-medium text-gray-700">
                      Key
                    </label>
                    <input
                      id={`${providerId}-api-key`}
                      type="password"
                      placeholder={`${providerConfig.name || providerId} API key`}
                      value={providerConfig.apiKey || ''}
                      onChange={e => handleApiKeyChange(providerId, e.target.value, providerConfig.baseUrl)}
                      className="flex-1 p-2 rounded-md bg-gray-50 border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-200 outline-none"
                    />
                  </div>

                  {/* Base URL input (for custom_openai and ollama) */}
                  {(providerConfig.type === ProviderTypeEnum.CustomOpenAI ||
                    providerConfig.type === ProviderTypeEnum.Ollama) && (
                    <div className="flex flex-col">
                      <div className="flex items-center">
                        <label htmlFor={`${providerId}-base-url`} className="w-20 text-sm font-medium text-gray-700">
                          Base URL{providerConfig.type === ProviderTypeEnum.CustomOpenAI ? '*' : ''}
                        </label>
                        <input
                          id={`${providerId}-base-url`}
                          type="text"
                          placeholder={
                            providerConfig.type === ProviderTypeEnum.CustomOpenAI
                              ? 'Required for custom OpenAI providers'
                              : 'Ollama base URL'
                          }
                          value={providerConfig.baseUrl || ''}
                          onChange={e => handleApiKeyChange(providerId, providerConfig.apiKey || '', e.target.value)}
                          className="flex-1 p-2 rounded-md bg-gray-50 border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-200 outline-none"
                        />
                      </div>
                    </div>
                  )}

                  {/* Models input field with tags */}
                  <div className="flex items-start">
                    <label htmlFor={`${providerId}-models`} className="w-20 text-sm font-medium text-gray-700 pt-2">
                      Models
                    </label>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 p-2 bg-gray-50 border border-gray-200 rounded-md min-h-[42px]">
                        {/* Display existing models as tags */}
                        {(() => {
                          // Get models from provider config or default models
                          const models =
                            providerConfig.modelNames !== undefined
                              ? providerConfig.modelNames
                              : llmProviderModelNames[providerId as keyof typeof llmProviderModelNames] || [];

                          return models.map(model => (
                            <div
                              key={model}
                              className="flex items-center bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm">
                              <span>{model}</span>
                              <button
                                type="button"
                                onClick={() => removeModel(providerId, model)}
                                className="ml-1 text-blue-600 hover:text-blue-800 font-bold"
                                aria-label={`Remove ${model}`}>
                                ×
                              </button>
                            </div>
                          ));
                        })()}

                        {/* Input for new models */}
                        <input
                          id={`${providerId}-models`}
                          type="text"
                          placeholder=""
                          value={newModelInputs[providerId] || ''}
                          onChange={e => handleModelsChange(providerId, e.target.value)}
                          onKeyDown={e => handleKeyDown(e, providerId)}
                          className="flex-1 min-w-[150px] outline-none bg-transparent border-none p-1"
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Type and Press Enter or Space to add a model</p>
                    </div>
                  </div>

                  {/* Ollama reminder at the bottom of the section */}
                  {providerConfig.type === ProviderTypeEnum.Ollama && (
                    <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
                      <p className="text-sm text-amber-700">
                        <strong>Remember:</strong> Add{' '}
                        <code className="bg-amber-100 px-1 py-0.5 rounded">OLLAMA_ORIGINS=chrome-extension://*</code>{' '}
                        environment variable for the Ollama server.
                        <a
                          href="https://github.com/ollama/ollama/issues/6489"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 ml-1">
                          Learn more
                        </a>
                      </p>
                    </div>
                  )}
                </div>

                {/* Add divider except for the last item */}
                {Object.keys(providers).indexOf(providerId) < Object.keys(providers).length - 1 && (
                  <div className="border-t border-gray-200 mt-4" />
                )}
              </div>
            ))
          )}

          {/* Add Provider button and dropdown */}
          <div className="pt-4 relative provider-selector-container">
            <Button
              variant="secondary"
              onClick={() => setIsProviderSelectorOpen(prev => !prev)}
              className="w-full flex items-center justify-center">
              <span className="mr-2">+</span> Add Provider
            </Button>

            {isProviderSelectorOpen && (
              <div className="absolute z-10 mt-2 w-full bg-white rounded-md shadow-lg border border-gray-200 overflow-hidden">
                <div className="py-1">
                  {/* Check if all default providers are already added */}
                  {(providersFromStorage.has(OPENAI_PROVIDER) || modifiedProviders.has(OPENAI_PROVIDER)) &&
                    (providersFromStorage.has(ANTHROPIC_PROVIDER) || modifiedProviders.has(ANTHROPIC_PROVIDER)) &&
                    (providersFromStorage.has(GEMINI_PROVIDER) || modifiedProviders.has(GEMINI_PROVIDER)) &&
                    (providersFromStorage.has(OLLAMA_PROVIDER) || modifiedProviders.has(OLLAMA_PROVIDER)) && (
                      <div className="px-4 py-2 text-sm text-gray-500">
                        All default providers already added. You can still add a custom provider.
                      </div>
                    )}

                  {!providersFromStorage.has(OPENAI_PROVIDER) && !modifiedProviders.has(OPENAI_PROVIDER) && (
                    <button
                      type="button"
                      className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 transition-colors duration-150 flex items-center"
                      onClick={() => handleProviderSelection(OPENAI_PROVIDER)}>
                      <span className="font-medium">OpenAI</span>
                    </button>
                  )}

                  {!providersFromStorage.has(ANTHROPIC_PROVIDER) && !modifiedProviders.has(ANTHROPIC_PROVIDER) && (
                    <button
                      type="button"
                      className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 transition-colors duration-150 flex items-center"
                      onClick={() => handleProviderSelection(ANTHROPIC_PROVIDER)}>
                      <span className="font-medium">Anthropic</span>
                    </button>
                  )}

                  {!providersFromStorage.has(GEMINI_PROVIDER) && !modifiedProviders.has(GEMINI_PROVIDER) && (
                    <button
                      type="button"
                      className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 transition-colors duration-150 flex items-center"
                      onClick={() => handleProviderSelection(GEMINI_PROVIDER)}>
                      <span className="font-medium">Gemini</span>
                    </button>
                  )}

                  {!providersFromStorage.has(OLLAMA_PROVIDER) && !modifiedProviders.has(OLLAMA_PROVIDER) && (
                    <button
                      type="button"
                      className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 transition-colors duration-150 flex items-center"
                      onClick={() => handleProviderSelection(OLLAMA_PROVIDER)}>
                      <span className="font-medium">Ollama</span>
                    </button>
                  )}

                  <button
                    type="button"
                    className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 transition-colors duration-150 flex items-center"
                    onClick={() => handleProviderSelection('custom')}>
                    <span className="font-medium">Custom OpenAI-compatible</span>
                  </button>
                </div>
              </div>
            )}
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
