import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { THINK_REGEX } from '../../shared/thinking';

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

export function cleanHeadingText(rawText: string): string {
  let cleaned = rawText.trim();

  cleaned = cleaned.replace(/\s+#+\s*$/, '');
  cleaned = cleaned.replace(/<\/?[A-Za-z][A-Za-z0-9-]*(?:\s+[^>]*)?\s*\/?>/g, '');
  cleaned = cleaned.replace(/\\(display|script)style/g, '');
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  cleaned = cleaned.replace(/\$([^$]+)\$/g, '$1');
  cleaned = cleaned.replace(/(\*\*\*|___)(.*?)\1/g, '$2');
  cleaned = cleaned.replace(/(\*\*|__)(.*?)\1/g, '$2');
  cleaned = cleaned.replace(/(\*|_)(.*?)\1/g, '$2');
  cleaned = cleaned.replace(/`([^`]+)`/g, '$1');

  return cleaned.trim();
}

const remarkProcessor = unified().use(remarkParse).use(remarkGfm).use(remarkMath);

export function stripNonContentForTOC(content: string): string {
  let text = content;
  text = text.replace(THINK_REGEX, '');
  return text;
}

function getASTNodeText(node: any): string {
  if (!node) return '';
  if (node.type === 'text' || node.type === 'inlineCode' || node.type === 'inlineMath') {
    return node.value || '';
  }
  if (node.type === 'image' || node.type === 'imageReference') {
    return node.alt || '';
  }
  if (node.children && Array.isArray(node.children)) {
    return node.children.map(getASTNodeText).join('');
  }
  return '';
}

export function extractHeadingsFromContent(messageId: string, content: string): TOCHeading[] {
  let cleanContent = stripNonContentForTOC(content);

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
