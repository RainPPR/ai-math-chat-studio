```typescript
import React, { memo } from 'react';
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
import "katex/dist/contrib/mhchem.mjs";

interface MarkdownRendererProps {
  content: string;
  messageId?: string;
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

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = memo(({ content, messageId }) => {
  let processedContent = content;
  
  // Replace \[ ... \] with $$ ... $$
  processedContent = processedContent.replace(/\\\[([\s\S]*?)\\\]/g, (match, p1) => `$$${p1}$$`);
  
  // Replace \( ... \) with $ ... $
  processedContent = processedContent.replace(/\\\(([\s\S]*?)\\\)/g, (match, p1) => `$${p1}$`);

  const rehypePluginsList: any[] = [
    rehypeRaw,
    rehypeSanitize,
    [rehypeKatex, {
      strict: false,
      throwOnError: false,
      macros: {
        '\\tag': '\\qquad (#1)',
        '\\male': '\\text{♂}',
        '\\female': '\\text{♀}',
        '\\vec': '\\bm{#1}'
      }
    }],
    [rehypeExternalLinks, { target: '_blank', rel: ['noopener', 'noreferrer'] }]
  ];

  if (messageId) {
    rehypePluginsList.push(() => rehypeTocHeadingIds(messageId));
  }

  return (
    <div className="prose prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[
          remarkGfm, 
          remarkMath, 
          remarkBreaks, 
          remarkSqueezeParagraphs, 
          remarkCjkFriendly
        ]}
        rehypePlugins={rehypePluginsList}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
});

MarkdownRenderer.displayName = 'MarkdownRenderer';

```