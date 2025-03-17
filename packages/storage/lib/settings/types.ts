// Agent name, used to identify the agent in the settings
export enum AgentNameEnum {
  Planner = 'planner',
  Navigator = 'navigator',
  Validator = 'validator',
}

// Provider type, types before CustomOpenAI are built-in providers, CustomOpenAI is a custom provider
// For built-in providers, we will create ChatModel instances with its respective LangChain ChatModel classes
// For custom providers, we will create ChatModel instances with the ChatOpenAI class
export enum ProviderTypeEnum {
  OpenAI = 'openai',
  Anthropic = 'anthropic',
  Gemini = 'gemini',
  Ollama = 'ollama',
  CustomOpenAI = 'custom_openai',
}

// Default supported models for each built-in provider
export const llmProviderModelNames = {
  [ProviderTypeEnum.OpenAI]: ['gpt-4o', 'gpt-4o-mini', 'o1', 'o1-mini', 'o3-mini'],
  [ProviderTypeEnum.Anthropic]: ['claude-3-7-sonnet-latest', 'claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest'],
  [ProviderTypeEnum.Gemini]: [
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-2.0-pro-exp-02-05',
    // 'gemini-2.0-flash-thinking-exp-01-21', // TODO: not support function calling for now
  ],
  [ProviderTypeEnum.Ollama]: [],
  // Custom OpenAI providers don't have predefined models as they are user-defined
};

// Default parameters for each agent per provider, for providers not specified, use OpenAI parameters
export const llmProviderParameters = {
  [ProviderTypeEnum.OpenAI]: {
    [AgentNameEnum.Planner]: {
      temperature: 0.01,
      topP: 0.001,
    },
    [AgentNameEnum.Navigator]: {
      temperature: 0,
      topP: 0.001,
    },
    [AgentNameEnum.Validator]: {
      temperature: 0,
      topP: 0.001,
    },
  },
  [ProviderTypeEnum.Anthropic]: {
    [AgentNameEnum.Planner]: {
      temperature: 0.1,
      topP: 0.1,
    },
    [AgentNameEnum.Navigator]: {
      temperature: 0.1,
      topP: 0.1,
    },
    [AgentNameEnum.Validator]: {
      temperature: 0.05,
      topP: 0.1,
    },
  },
  [ProviderTypeEnum.Gemini]: {
    [AgentNameEnum.Planner]: {
      temperature: 0.01,
      topP: 0.1,
    },
    [AgentNameEnum.Navigator]: {
      temperature: 0.01,
      topP: 0.1,
    },
    [AgentNameEnum.Validator]: {
      temperature: 0.1,
      topP: 0.1,
    },
  },
  [ProviderTypeEnum.Ollama]: {
    [AgentNameEnum.Planner]: {
      temperature: 0,
      topP: 0.001,
    },
    [AgentNameEnum.Navigator]: {
      temperature: 0.01,
      topP: 0.001,
    },
    [AgentNameEnum.Validator]: {
      temperature: 0,
      topP: 0.001,
    },
  },
};
