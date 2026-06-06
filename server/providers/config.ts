import { BUILT_IN_PROVIDERS } from './built-in';

export function getBuiltInProvider(type: string) {
  return BUILT_IN_PROVIDERS[type] || undefined;
}

export function getDefaultEnvKey(type: string): string | undefined {
  return BUILT_IN_PROVIDERS[type]?.defaultEnvKey;
}

export function getDefaultBaseURL(type: string): string | undefined {
  return BUILT_IN_PROVIDERS[type]?.defaultBaseURL;
}

interface ProviderInstance {
  baseURL?: string;
  apiKey?: string;
  envKey?: string;
  type: string;
}

export function resolveApiKey(provider: ProviderInstance): string | undefined {
  if (provider.apiKey) return provider.apiKey;
  const envKey = provider.envKey || BUILT_IN_PROVIDERS[provider.type]?.defaultEnvKey;
  if (envKey) return process.env[envKey];
  return process.env.OPENAI_API_KEY;
}

export function resolveBaseURL(provider: ProviderInstance): string | undefined {
  // Nvidia baseURL is fixed and cannot be overridden
  if (provider.type === 'nvidia') {
    return BUILT_IN_PROVIDERS.nvidia.defaultBaseURL;
  }
  if (provider.baseURL) return provider.baseURL;
  return BUILT_IN_PROVIDERS[provider.type]?.defaultBaseURL;
}
