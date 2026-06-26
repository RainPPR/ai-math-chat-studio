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

// @ts-expect-error
import "katex/dist/contrib/mhchem";

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = memo(({ content }) => {
  let processedContent = content;
  
  // Replace \[ ... \] with $$ ... $$
  processedContent = processedContent.replace(/\\\[([\s\S]*?)\\\]/g, (match, p1) => `$$${p1}$$`);
  
  // Replace \( ... \) with $ ... $
  processedContent = processedContent.replace(/\\\(([\s\S]*?)\\\)/g, (match, p1) => `$${p1}$`);

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
        rehypePlugins={[
          rehypeRaw, 
          rehypeSanitize, 
          [rehypeKatex, { strict: false, throwOnError: false, macros: { '\\tag': '\\qquad (#1)' } }], 
          [rehypeExternalLinks, { target: '_blank', rel: ['noopener', 'noreferrer'] }]
        ]}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
});

MarkdownRenderer.displayName = 'MarkdownRenderer';
