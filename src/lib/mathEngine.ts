import katex from 'katex';
import { MathEngine } from '../types';

declare global {
  interface Window {
    MathJax?: any;
    __activeMathEngine?: MathEngine;
  }
}

const loadedScripts = new Map<string, { promise: Promise<void>; element: HTMLScriptElement }>();

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

  loadedScripts.set(src, { promise, element: scriptEl! });
  return promise;
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
      // Remove previously loaded MathJax scripts so switching re-loads cleanly
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
        displayMode: display,
        throwOnError: false,
        strict: false,
        macros: {
          '\\tag': '\\qquad (#1)',
          '\\male': '\\text{♂}',
          '\\female': '\\text{♀}',
          '\\vec': '\\bm{#1}',
        },
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
      container.innerHTML = katex.renderToString(math, { displayMode: display, throwOnError: false });
      return;
    }

    if (engine === 'mathjax-v2') {
      container.innerHTML = rawTex;
      if (window.MathJax && window.MathJax.Hub) {
        await new Promise<void>((resolve) => {
          window.MathJax.Hub.Queue(['Typeset', window.MathJax.Hub, container], resolve);
        });
      }
    } else if (engine === 'mathjax-v3' || engine === 'mathjax-v4') {
      container.innerHTML = rawTex;
      if (window.MathJax && window.MathJax.typesetPromise) {
        if (window.MathJax.typesetClear) {
          try {
            window.MathJax.typesetClear([container]);
          } catch {}
        }
        try {
          await window.MathJax.typesetPromise([container]);
        } catch (e) {
          console.warn(`${engine} typeset error:`, e);
        }
      }
    }
  });
}
