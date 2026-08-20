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
 * Clean Markdown inline formatting (bold, italic, code, links, math, katex formatting)
 * to produce clean display text for TOC items.
 */
export function cleanHeadingText(rawText: string): string {
  let cleaned = rawText.trim();

  // Strip trailing hashes e.g. ## Title ##
  cleaned = cleaned.replace(/\s+#+\s*$/, '');

  // Strip LaTeX formatting directives like \displaystyle, \scriptstyle
  cleaned = cleaned.replace(/\\(display|script)style/g, '');

  // Strip Markdown links [text](url) -> text
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // Strip inline math $...$ -> ...
  cleaned = cleaned.replace(/\$([^$]+)\$/g, '$1');

  // Strip bold/italic ***text***, **text**, *text*, ___text___, __text__, _text_
  cleaned = cleaned.replace(/(\*\*|__|\*|_)(.*?)\1/g, '$2');

  // Strip inline code `code` -> code
  cleaned = cleaned.replace(/`([^`]+)`/g, '$1');

  return cleaned.trim();
}

/**
 * Remove code blocks and <think> blocks from markdown before extracting headings
 * to avoid false positives (e.g. comments in code blocks or headers in thinking).
 */
export function stripNonContentForTOC(content: string): string {
  let text = content;

  // Remove <think>...</think> blocks or unclosed <think>...
  text = text.replace(/<think>(?:[\s\S]*?)(?:<\/think>|$)/gi, '');

  // Remove triple backtick / tilde code blocks ```...``` or ~~~...~~~
  text = text.replace(/(?:```|~~~)[\s\S]*?(?:```|~~~|$)/g, '');

  return text;
}

/**
 * Fast regex-based heading extractor for a message's content.
 */
export function extractHeadingsFromContent(messageId: string, content: string): TOCHeading[] {
  const cleanContent = stripNonContentForTOC(content);
  const headings: TOCHeading[] = [];

  // Match Markdown headings at the start of a line: # Heading, ## Heading, etc.
  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  let match: RegExpExecArray | null;
  let headingIndex = 0;

  while ((match = headingRegex.exec(cleanContent)) !== null) {
    const hashes = match[1];
    const rawHeadingText = match[2];
    const level = hashes.length;
    const text = cleanHeadingText(rawHeadingText);

    if (text) {
      headings.push({
        id: `toc-msg-${messageId}-h-${headingIndex}`,
        level,
        text,
        messageId,
        headingIndex,
      });
      headingIndex++;
    }
  }

  return headings;
}
