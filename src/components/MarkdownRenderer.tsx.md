```typescript
import React, { memo, useRef, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import remarkSqueezeParagraphs from 'remark-squeeze-paragraphs';

import remarkCjkFriendly from 'remark-cjk-friendly';

import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import rehypeExternalLinks from 'rehype-external-links';
import rehypeSanitize from 'rehype-sanitize';
import 'katex/dist/katex-swap.min.css';

import 'katex';
import 'katex/dist/contrib/mhchem.mjs';
import { MathEngine } from '../types';
import { renderMathToElement, SHARED_KATEX_OPTIONS } from '../lib/mathEngine';

interface MarkdownRendererProps {
  content: string;
  messageId?: string;
  mathEngine?: MathEngine;
}

/**
 * Custom rehype plugin to assign deterministic IDs to headings in AST document order.
 * Operates during the rehype AST pass, making ID assignment static and immune to React StrictMode re-renders.
 */
function rehypeTocHeadingIds(messageId: string) {
  return (tree: any) => {
    let index = 0;
    const visit = (node: any) => {
      if (!node) return;
      if (node.type === 'element' && ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(node.tagName)) {
        node.properties = node.properties || {};
        node.properties.id = `toc-msg-${messageId}-h-${index++}`;
      }
      if (node.children && Array.isArray(node.children)) {
        node.children.forEach(visit);
      }
    };
    visit(tree);
  };
}

/**
 * Custom rehype plugin to transform math AST elements into custom <math-node> elements
 * when using MathJax math engines.
 */
function rehypeMathTransform() {
  return (tree: any) => {
    const visit = (node: any) => {
      if (!node) return;
      if (node.type === 'element' && node.tagName === 'code' && node.properties?.className) {
        const classes = Array.isArray(node.properties.className)
          ? node.properties.className
          : String(node.properties.className).split(' ');
        if (classes.includes('language-math')) {
          const isDisplay = classes.includes('math-display');
          node.tagName = 'math-node';
          node.properties = {
            'data-math': String(node.children?.[0]?.value || '').trim(),
            'data-display': isDisplay ? 'true' : 'false',
          };
        }
      }
      if (node.children && Array.isArray(node.children)) {
        node.children.forEach(visit);
      }
    };
    visit(tree);
  };
}

const MathNode: React.FC<{ math: string; display: boolean; engine: MathEngine }> = ({ math, display, engine }) => {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (ref.current) {
      renderMathToElement(ref.current, math, display, engine);
    }
  }, [math, display, engine]);

  if (display) {
    return <div ref={ref as any} className="my-2 overflow-x-auto text-center math-display-wrapper" />;
  }
  return <span ref={ref} className="inline-block align-middle math-inline-wrapper" />;
};

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = memo(({ content, messageId, mathEngine = 'katex' }) => {
  let processedContent = content;

  // Replace \[ ... \] with $$ ... $$
  processedContent = processedContent.replace(/\\\[([\s\S]*?)\\\]/g, (match, p1) => `$$${p1}$$`);

  // Replace \( ... \) with $ ... $
  processedContent = processedContent.replace(/\\\(([\s\S]*?)\\\)/g, (match, p1) => `$${p1}$`);

  const isKatex = !mathEngine || mathEngine === 'katex';

  const rehypePluginsList: any[] = [rehypeRaw, rehypeSanitize];

  if (isKatex) {
    rehypePluginsList.push([rehypeKatex, SHARED_KATEX_OPTIONS]);
  } else {
    rehypePluginsList.push(rehypeMathTransform);
  }

  rehypePluginsList.push([rehypeExternalLinks, { target: '_blank', rel: ['noopener', 'noreferrer'] }]);

  if (messageId) {
    rehypePluginsList.push(() => rehypeTocHeadingIds(messageId));
  }

  const customComponents: Record<string, any> = useMemo(() => {
    if (isKatex) {
      return {};
    }
    return {
      'math-node': (props: any) => {
        const math = props['data-math'] || '';
        const display = props['data-display'] === 'true';
        return <MathNode math={math} display={display} engine={mathEngine} />;
      },
      pre: ({ children, node: _node, ...props }: any) => {
        const isMath = React.Children.toArray(children).some(
          (child: any) => child && (child.type === 'math-node' || (child.props && child.props['data-math']))
        );
        if (isMath) {
          return <>{children}</>;
        }
        return <pre {...props}>{children}</pre>;
      },
    };
  }, [isKatex, mathEngine]);

  return (
    <div className="prose prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[
          remarkGfm,
          remarkMath,
          remarkBreaks,
          remarkSqueezeParagraphs,
          remarkCjkFriendly,
        ]}
        rehypePlugins={rehypePluginsList}
        components={customComponents}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
});

MarkdownRenderer.displayName = 'MarkdownRenderer';

```