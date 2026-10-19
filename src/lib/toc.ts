export interface TOCHeading {
  id: string;
  level: number;
  text: string;
  messageId: string;
  headingIndex: number;
}

export interface MessageTOC {
  messageId: string;
  role: 'user' | 'model';
  snippet: string;
  headings: TOCHeading[];
}

/**
 * Clean Markdown inline formatting (bold, italic, code, links, math, katex formatting, HTML tags)
 * to produce clean display text for TOC items.
 */
export function cleanHeadingText(rawText: string): string {
  let cleaned = rawText.trim();

  // Strip trailing hashes e.g. ## Title ##
  cleaned = cleaned.replace(/\s+#+\s*$/, '');

  // Strip HTML tags requiring valid tag name boundary
  cleaned = cleaned.replace(/<\/?[A-Za-z][A-Za-z0-9-]*(?:\s+[^>]*)?\s*\/?>/g, '');

  // Strip LaTeX formatting directives like \displaystyle, \scriptstyle
  cleaned = cleaned.replace(/\\(display|script)style/g, '');

  // Strip Markdown links [text](url) -> text
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // Strip inline math $...$ -> ...
  cleaned = cleaned.replace(/\$([^$]+)\$/g, '$1');

  // Strip triple emphasis ***text*** or ___text___ first
  cleaned = cleaned.replace(/(\*\*\*|___)(.*?)\1/g, '$2');

  // Strip double emphasis **text** or __text__
  cleaned = cleaned.replace(/(\*\*|__)(.*?)\1/g, '$2');

  // Strip single emphasis *text* or _text_
  cleaned = cleaned.replace(/(\*|_)(.*?)\1/g, '$2');

  // Strip inline code `code` -> code
  cleaned = cleaned.replace(/`([^`]+)`/g, '$1');

  return cleaned.trim();
}

/**
 * Remove code blocks, math blocks ($$...$$, \[...\], \begin{...}...\end{...}), and <think> blocks
 * from markdown before extracting headings to avoid false positives
 * (e.g. comments in code blocks, math equation lines formatted like Setext headers, or headers in thinking).
 * Matches line-anchored code fences properly with matching opening and closing fence boundaries
 * or true end-of-file fallback.
 */
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { THINK_REGEX } from '../../shared/thinking';

// Reuse processor instance across calls for optimal performance
const remarkProcessor = unified().use(remarkParse).use(remarkGfm).use(remarkMath);

export function stripNonContentForTOC(content: string): string {
  let text = content;

  // Remove <think>...</think> blocks or unclosed <think>...
  text = text.replace(THINK_REGEX, '');

  return text;
}

/**
 * Extract plain text recursively from a remark AST node
 */
function getASTNodeText(node: any): string {
  if (!node) return '';
  if (node.type === 'text' || node.type === 'inlineCode' || node.type === 'inlineMath') {
    return node.value || '';
  }
  if (node.children && Array.isArray(node.children)) {
    return node.children.map(getASTNodeText).join('');
  }
  return '';
}

/**
 * Robust AST-based heading extractor using remark-parse.
 * Parses Markdown into an AST tree and collects heading nodes in exact document order,
 * ensuring 1:1 match with ReactMarkdown/rehypeTocHeadingIds AST rendering.
 */
export function extractHeadingsFromContent(messageId: string, content: string): TOCHeading[] {
  let cleanContent = stripNonContentForTOC(content);

  // Normalize display math delimiters as MarkdownRenderer does
  cleanContent = cleanContent.replace(/\\\[([\s\S]*?)\\\]/g, (_match, p1) => `$$${p1}$$`);
  cleanContent = cleanContent.replace(/\\\(([\s\S]*?)\\\)/g, (_match, p1) => `$${p1}$`);

  const headings: TOCHeading[] = [];
  const tree = remarkProcessor.parse(cleanContent);
  let headingIndex = 0;

  function visit(node: any) {
    if (!node) return;
    if (node.type === 'heading') {
      const rawText = getASTNodeText(node);
      const text = cleanHeadingText(rawText);
      if (text) {
        headings.push({
          id: `toc-msg-${messageId}-h-${headingIndex}`,
          level: Math.min(Math.max(node.depth || 1, 1), 6),
          text,
          messageId,
          headingIndex,
        });
        headingIndex++;
      }
    }
    if (node.children && Array.isArray(node.children)) {
      node.children.forEach(visit);
    }
  }

  visit(tree);
  return headings;
}
