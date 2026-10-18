import katex, { KatexOptions } from 'katex';
import { MathEngine } from '../types';

declare global {
  interface Window {
    MathJax?: any;
    __activeMathEngine?: MathEngine;
  }
}

export const SHARED_KATEX_OPTIONS: KatexOptions = {
  strict: false,
  throwOnError: false,
  macros: {
    '\\tag': '\\qquad (#1)',
    '\\male': '\\text{♂}',
    '\\female': '\\text{♀}',
    '\\vec': '\\bm{#1}',
  },
};

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

  // If engine changed, clean up conflicting window.MathJax instance & scripts
  if (window.__activeMathEngine && window.__activeMathEngine !== engine) {
    if (engine.startsWith('mathjax') || window.__activeMathEngine.startsWith('mathjax')) {
      delete window.MathJax;
      removeScript('https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.9/MathJax.js?config=TeX-AMS_HTML');
      removeScript('https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-chtml.js');
      removeScript('https://cdn.jsdelivr.net/npm/mathjax@4.1.3/tex-chtml.js');
    }
  }
  window.__activeMathEngine = engine;

  if (engine === 'katex') {
    return;
  }

  if (engine === 'mathjax-v2') {
    if (!window.MathJax || !window.MathJax.Hub) {
      window.MathJax = {
        skipStartupTypeset: true,
        tex2jax: {
          inlineMath: [['\\(', '\\)'], ['$', '$']],
          displayMath: [['\\[', '\\]'], ['$$', '$$']],
          processEscapes: true,
        },
        TeX: {
          Macros: {
            tag: ['\\qquad (#1)', 1],
            male: '{\\text{♂}}',
            female: '{\\text{♀}}',
            vec: ['\\bm{#1}', 1],
          },
        },
        'HTML-CSS': {
          preferredFont: 'TeX',
          availableFonts: ['TeX', 'STIX-Web', 'Asana-Math'],
          showMathMenu: false,
        },
        AuthorInit: function () {
          if (window.MathJax && window.MathJax.Hub) {
            window.MathJax.Hub.Config({
              showMathMenu: false,
              messageStyle: 'none',
              tex2jax: {
                inlineMath: [['\\(', '\\)'], ['$', '$']],
                displayMath: [['\\[', '\\]'], ['$$', '$$']],
                processEscapes: true,
              },
              TeX: {
                Macros: {
                  tag: ['\\qquad (#1)', 1],
                  male: '{\\text{♂}}',
                  female: '{\\text{♀}}',
                  vec: ['\\bm{#1}', 1],
                },
              },
            });
          }
        },
      };
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.9/MathJax.js?config=TeX-AMS_HTML');
    }
    return;
  }

  if (engine === 'mathjax-v3' || engine === 'mathjax-v4') {
    const isV4 = engine === 'mathjax-v4';
    const scriptUrl = isV4
      ? 'https://cdn.jsdelivr.net/npm/mathjax@4.1.3/tex-chtml.js'
      : 'https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-chtml.js';

    if (!window.MathJax || !window.MathJax.typesetPromise) {
      window.MathJax = {
        tex: {
          inlineMath: [['\\(', '\\)'], ['$', '$']],
          displayMath: [['\\[', '\\]'], ['$$', '$$']],
          processEscapes: true,
          packages: { '[+]': ['mhchem'] },
          macros: {
            tag: ['\\qquad (#1)', 1],
            male: '{\\text{♂}}',
            female: '{\\text{♀}}',
            vec: ['\\bm{#1}', 1],
          },
        },
        loader: {
          load: ['[tex]/mhchem'],
        },
        options: {
          skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
          enableMenu: false,
        },
        startup: {
          typeset: false,
        },
      };
      await loadScript(scriptUrl);
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
    } else if (engine === 'mathjax-v3' || engine === 'mathjax-v4') {
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
            `${engine} typeset timed out`
          );
        } catch (e) {
          console.warn(`${engine} typeset error:`, e);
        }
      }
    }
  });
}
