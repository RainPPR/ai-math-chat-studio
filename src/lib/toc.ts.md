````typescript
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
 * Remove code blocks and <think> blocks from markdown before extracting headings
 * to avoid false positives (e.g. comments in code blocks or headers in thinking).
 * Matches line-anchored code fences properly with matching opening and closing fence boundaries
 * or true end-of-file fallback.
 */
export function stripNonContentForTOC(content: string): string {
  let text = content;

  // Remove <think>...</think> blocks or unclosed <think>...
  text = text.replace(/<think>(?:[\s\S]*?)(?:<\/think>|$)/gi, '');

  // Remove line-anchored code blocks ```...``` or ~~~...~~~
  text = text.replace(/^[ \t]*(```|~~~)[^\n]*\n[\s\S]*?(?:\n[ \t]*\1[ \t]*\r?$|$(?![\s\S]))/gm, '');

  return text;
}

/**
 * Fast heading extractor for a message's content supporting ATX (#) and Setext (=== / ---) headings,
 * including leading space indentation up to 3 spaces per Markdown standard.
 */
export function extractHeadingsFromContent(messageId: string, content: string): TOCHeading[] {
  const cleanContent = stripNonContentForTOC(content);
  const headings: TOCHeading[] = [];

  const lines = cleanContent.split(/\r?\n/);
  let headingIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check ATX headings: # Heading (up to 3 leading spaces)
    const atxMatch = /^ {0,3}(#{1,6})\s+(.+)$/.exec(line);
    if (atxMatch) {
      const level = atxMatch[1].length;
      const text = cleanHeadingText(atxMatch[2]);
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
      continue;
    }

    // Check Setext headings: Line followed by === or --- (up to 3 leading spaces)
    if (i + 1 < lines.length && line.trim().length > 0) {
      const nextLine = lines[i + 1];
      if (/^ {0,3}=+\s*$/.test(nextLine)) {
        const text = cleanHeadingText(line);
        if (text) {
          headings.push({
            id: `toc-msg-${messageId}-h-${headingIndex}`,
            level: 1,
            text,
            messageId,
            headingIndex,
          });
          headingIndex++;
        }
        i++; // skip underline line
        continue;
      } else if (/^ {0,3}-+\s*$/.test(nextLine) && !/^\s*[-*+]\s+/.test(line)) {
        const text = cleanHeadingText(line);
        if (text) {
          headings.push({
            id: `toc-msg-${messageId}-h-${headingIndex}`,
            level: 2,
            text,
            messageId,
            headingIndex,
          });
          headingIndex++;
        }
        i++; // skip underline line
        continue;
      }
    }
  }

  return headings;
}

````