/// <reference types="vite/client" />

declare module 'react-dom/client';

declare module 'pandoc-wasm' {
  export interface ConvertOptions {
    from?: string;
    to?: string;
    standalone?: boolean;
    wrap?: string;
    [key: string]: any;
  }

  export interface ConvertResult {
    stdout: string;
    stderr?: string;
  }

  export function convert(
    options: ConvertOptions,
    input: string,
    files: Record<string, any>
  ): Promise<ConvertResult>;
}
