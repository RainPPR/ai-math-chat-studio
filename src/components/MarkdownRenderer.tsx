import React, { memo, useMemo, useRef } from 'react';
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
// Import the ESM version of mhchem to ensure it registers on the same katex instance
import "katex/dist/contrib/mhchem.mjs";

interface MarkdownRendererProps {
  content: string;
  messageId?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = memo(({ content, messageId }) => {
  let processedContent = content;
  
  // Replace \[ ... \] with $$ ... $$
  processedContent = processedContent.replace(/\\\[([\s\S]*?)\\\]/g, (match, p1) => `$$${p1}$$`);
  
  // Replace \( ... \) with $ ... $
  processedContent = processedContent.replace(/\\\(([\s\S]*?)\\\)/g, (match, p1) => `$${p1}$`);

  // Ref to track heading index during render pass
  const headingIndexRef = useRef(0);
  headingIndexRef.current = 0;

  // Build heading components that inject deterministic IDs matching TOC extraction
  const customComponents = useMemo(() => {
    if (!messageId) return undefined;

    const createHeadingComponent = (Tag: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6') => {
      return ({ children, ...props }: any) => {
        const id = `toc-msg-${messageId}-h-${headingIndexRef.current++}`;
        return <Tag id={id} {...props}>{children}</Tag>;
      };
    };

    return {
      h1: createHeadingComponent('h1'),
      h2: createHeadingComponent('h2'),
      h3: createHeadingComponent('h3'),
      h4: createHeadingComponent('h4'),
      h5: createHeadingComponent('h5'),
      h6: createHeadingComponent('h6'),
    };
  }, [messageId]);

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
          [rehypeKatex, {
            strict: false,
            throwOnError: false,
            macros: { '\\tag': '\\qquad (#1)' }
          }],
          [rehypeExternalLinks, { target: '_blank', rel: ['noopener', 'noreferrer'] }]
        ]}
        components={customComponents}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
});

MarkdownRenderer.displayName = 'MarkdownRenderer';
