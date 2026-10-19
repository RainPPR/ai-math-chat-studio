import { KatexOptions } from 'katex';

export interface CustomMacro {
  name: string;
  definition: string;
  args?: number;
}

export const CENTRAL_MACROS: CustomMacro[] = [
  { name: 'tag', definition: '\\qquad (#1)', args: 1 },
  { name: 'male', definition: '\\text{♂}' },
  { name: 'female', definition: '\\text{♀}' },
  { name: 'vec', definition: '\\bm{#1}', args: 1 },
];

export function buildKatexMacros(): Record<string, string> {
  const macros: Record<string, string> = {};
  for (const m of CENTRAL_MACROS) {
    macros[`\\${m.name}`] = m.definition;
  }
  return macros;
}

export const SHARED_KATEX_OPTIONS: KatexOptions = {
  strict: false,
  throwOnError: false,
  macros: buildKatexMacros(),
};
