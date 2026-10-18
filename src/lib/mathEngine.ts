import katex, { KatexOptions } from 'katex';
import { MathEngine } from '../types';

declare global {
  interface Window {
    MathJax?: any;
    __activeMathEngine?: MathEngine;
  }
}

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

export function buildMathJaxV2Macros(): Record<string, any> {
  const macros: Record<string, any> = {};
  for (const m of CENTRAL_MACROS) {
    if (m.args && m.args > 0) {
      macros[m.name] = [m.definition, m.args];
    } else {
      macros[m.name] = `{${m.definition}}`;
    }
  }
  return macros;
}

export function buildMathJaxV3V4Macros(): Record<string, any> {
  const macros: Record<string, any> = {};
  for (const m of CENTRAL_MACROS) {
    if (m.args && m.args > 0) {
      macros[m.name] = [m.definition, m.args];
    } else {
      macros[m.name] = `{${m.definition}}`;
    }
  }
  return macros;
}

export const SHARED_KATEX_OPTIONS: KatexOptions = {
  strict: false,
  throwOnError: false,
  macros: buildKatexMacros(),
};

const MATHJAX_CDN_V2 = 'https://cdn.jsdelivr.net/npm/mathjax@2/MathJax.js?config=TeX-AMS_CHTML';
const MATHJAX_CDN_V3 = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml-full.js';
const MATHJAX_CDN_V4 = 'https://cdn.jsdelivr.net/npm/mathjax@4/tex-chtml.js';

const loadedScripts = new Map<string, { promise: Promise<void>; element: HTMLScriptElement }>();

function withTimeout<T>(promise: Promise<T>, timeoutMs = 10000, errorMsg = 'Operation timed out'): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(errorMsg)), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

function loadScript(src: string): Promise<void> {
  const existing = loadedScripts.get(src);
  if (existing) return existing.promise;

  let scriptEl: HTMLScriptElement;
  const promise = new Promise<void>((resolve, reject) => {
    scriptEl = document.createElement('script');
    scriptEl.src = src;
    scriptEl.async = true;
    scriptEl.onload = () => resolve();
    scriptEl.onerror = (err) => {
      loadedScripts.delete(src);
      if (scriptEl.parentNode) scriptEl.parentNode.removeChild(scriptEl);
      reject(err);
    };
    document.head.appendChild(scriptEl);
  });

  const timedPromise = withTimeout(promise, 10000, `Script load timed out: ${src}`);
  loadedScripts.set(src, { promise: timedPromise, element: scriptEl! });
  return timedPromise;
}

function removeScript(src: string) {
  const existing = loadedScripts.get(src);
  if (existing) {
    if (existing.element.parentNode) {
      existing.element.parentNode.removeChild(existing.element);
    }
    loadedScripts.delete(src);
  }
}

// Queue for MathJax typesetting calls to avoid race conditions
let typesetQueue: Promise<void> = Promise.resolve();

function enqueueTypeset<T>(fn: () => Promise<T>): Promise<T> {
  const res = typesetQueue.then(fn, fn);
  typesetQueue = res.then(
    () => {},
    () => {}
  );
  return res;
}

export async function loadMathEngine(engine: MathEngine): Promise<void> {
  if (typeof window === 'undefined') return;

  if (window.__activeMathEngine && window.__activeMathEngine !== engine) {
    if (engine.startsWith('mathjax') || window.__activeMathEngine.startsWith('mathjax')) {
      delete window.MathJax;
      removeScript(MATHJAX_CDN_V2);
      removeScript(MATHJAX_CDN_V3);
      removeScript(MATHJAX_CDN_V4);
    }
  }
  window.__activeMathEngine = engine;

  if (engine === 'katex') {
    return;
  }

  if (engine === 'mathjax-v2') {
    if (!window.MathJax || !window.MathJax.Hub) {
      const v2Macros = buildMathJaxV2Macros();
      window.MathJax = {
        skipStartupTypeset: true,
        messageStyle: 'none',
        showMathMenu: false,
        showProcessingMessages: false,
        tex2jax: {
          inlineMath: [['\\(', '\\)'], ['$', '$']],
          displayMath: [['\\[', '\\]'], ['$$', '$$']],
          processEscapes: true,
        },
        TeX: {
          Macros: v2Macros,
        },
        'fast-preview': { disabled: true },
        CommonHTML: {
          matchFontHeight: false,
          scale: 108,
          linebreaks: { automatic: false },
        },
        AuthorInit: function () {
          if (window.MathJax && window.MathJax.Hub) {
            window.MathJax.Hub.Config({
              showMathMenu: false,
              messageStyle: 'none',
              showProcessingMessages: false,
              tex2jax: {
                inlineMath: [['\\(', '\\)'], ['$', '$']],
                displayMath: [['\\[', '\\]'], ['$$', '$$']],
                processEscapes: true,
              },
              TeX: {
                Macros: v2Macros,
              },
              'fast-preview': { disabled: true },
              CommonHTML: {
                matchFontHeight: false,
                linebreaks: { automatic: false },
              },
            });
          }
        },
      };
      await loadScript(MATHJAX_CDN_V2);
    }
    return;
  }

  if (engine === 'mathjax-v3') {
    if (!window.MathJax || !window.MathJax.typesetPromise) {
      window.MathJax = {
        loader: {
          load: ['[tex]/mhchem'],
        },
        tex: {
          inlineMath: [['\\(', '\\)'], ['$', '$']],
          displayMath: [['\\[', '\\]'], ['$$', '$$']],
          processEscapes: true,
          packages: { '[+]': ['mhchem'] },
          macros: buildMathJaxV3V4Macros(),
        },
        options: {
          skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
          enableMenu: false,
        },
        startup: {
          typeset: false,
        },
      };
      await loadScript(MATHJAX_CDN_V3);
    }
    return;
  }

  if (engine === 'mathjax-v4') {
    if (!window.MathJax || (!window.MathJax.tex2chtmlPromise && !window.MathJax.typesetPromise)) {
      window.MathJax = {
        tex: {
          inlineMath: [['\\(', '\\)'], ['$', '$']],
          displayMath: [['\\[', '\\]'], ['$$', '$$']],
          processEscapes: true,
          macros: buildMathJaxV3V4Macros(),
        },
        options: {
          skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
          enableMenu: false,
        },
        startup: {
          typeset: false,
        },
      };
      await loadScript(MATHJAX_CDN_V4);
    }
    return;
  }
}

export async function renderMathToElement(
  container: HTMLElement,
  math: string,
  display: boolean,
  engine: MathEngine = 'katex'
): Promise<void> {
  if (!container) return;

  if (engine === 'katex') {
    try {
      container.innerHTML = katex.renderToString(math, {
        ...SHARED_KATEX_OPTIONS,
        displayMode: display,
      });
    } catch {
      container.textContent = display ? `\\[${math}\\]` : `\\(${math}\\)`;
    }
    return;
  }

  const rawTex = display ? `\\[${math}\\]` : `\\(${math}\\)`;

  return enqueueTypeset(async () => {
    try {
      await loadMathEngine(engine);
    } catch (err) {
      console.warn(`Failed to load ${engine}, falling back to KaTeX:`, err);
      container.innerHTML = katex.renderToString(math, {
        ...SHARED_KATEX_OPTIONS,
        displayMode: display,
      });
      return;
    }

    if (engine === 'mathjax-v2') {
      container.textContent = rawTex;
      if (window.MathJax && window.MathJax.Hub) {
        await withTimeout(
          new Promise<void>((resolve) => {
            window.MathJax.Hub.Queue(['Typeset', window.MathJax.Hub, container], resolve);
          }),
          10000,
          'MathJax v2 typeset timed out'
        ).catch((err) => console.warn('MathJax v2 typeset error:', err));
      }
    } else if (engine === 'mathjax-v3') {
      if (window.MathJax && window.MathJax.typesetClear) {
        try {
          window.MathJax.typesetClear([container]);
        } catch {}
      }
      container.textContent = rawTex;
      if (window.MathJax && window.MathJax.typesetPromise) {
        try {
          await withTimeout(
            window.MathJax.typesetPromise([container]),
            10000,
            'MathJax v3 typeset timed out'
          );
        } catch (e) {
          console.warn('MathJax v3 typeset error:', e);
        }
      }
    } else if (engine === 'mathjax-v4') {
      if (window.MathJax && window.MathJax.startup && window.MathJax.startup.promise) {
        try {
          await window.MathJax.startup.promise;
        } catch {}
      }
      if (window.MathJax && window.MathJax.typesetClear) {
        try {
          window.MathJax.typesetClear([container]);
        } catch {}
      }
      container.textContent = rawTex;
      if (window.MathJax && window.MathJax.typesetPromise) {
        try {
          await withTimeout(
            window.MathJax.typesetPromise([container]),
            10000,
            'MathJax v4 typeset timed out'
          );
        } catch (e) {
          console.warn('MathJax v4 typeset error:', e);
        }
      }
    }
  });
}
