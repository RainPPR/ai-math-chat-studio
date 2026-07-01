```typescript
export interface BuiltInProviderDef {
  type: string;
  name: string;
  defaultBaseURL?: string;
  defaultEnvKey: string;
}

export const BUILT_IN_PROVIDERS: Record<string, BuiltInProviderDef> = {
  google: {
    type: 'google',
    name: 'Google Gemini',
    defaultBaseURL: 'https://generativelanguage.googleapis.com/v1beta',
    defaultEnvKey: 'GEMINI_API_KEY',
  },
  nvidia: {
    type: 'nvidia',
    name: 'Nvidia NIM',
    defaultBaseURL: 'https://integrate.api.nvidia.com/v1',
    defaultEnvKey: 'NVIDIA_API_KEY',
  },
  'openai-compatible': {
    type: 'openai-compatible',
    name: 'OpenAI Compatible',
    defaultEnvKey: 'OPENAI_API_KEY',
  },
};

```