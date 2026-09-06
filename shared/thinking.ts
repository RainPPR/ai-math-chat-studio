/**
 * Utilities for handling <think> blocks in message content.
 */

/**
 * Global regex matching <think>...</think> blocks, including unclosed <think>... blocks.
 */
export const THINK_REGEX = /<think>(?:[\s\S]*?)(?:<\/think>|$)/gi;

/**
 * Regex matching strictly closed <think>...</think> blocks.
 */
export const CLOSED_THINK_REGEX = /<think>(?:[\s\S]*?)<\/think>/gi;

/**
 * Strips all <think>...</think> blocks (closed or unclosed) from content.
 */
export function stripThinking(content: string): string {
  if (!content) return '';
  return content.replace(THINK_REGEX, '').trim();
}

/**
 * Extracts thinking processes and main text content from a message.
 * @param content The raw message content
 * @param allowUnclosed Whether to include unclosed <think>... blocks (default: true).
 *                      Set to false for exports (e.g. Claude export) where unmatched tags shouldn't strip trailing content.
 */
export function extractThinkingBlocks(
  content: string,
  allowUnclosed = true
): { thoughts: string[]; mainContent: string } {
  if (!content) return { thoughts: [], mainContent: '' };
  const thoughts: string[] = [];

  if (allowUnclosed) {
    const thoughtRegex = /<think>(?:\r?\n)?([\s\S]*?)(?:(?:\r?\n)?<\/think>(?:\r?\n)*|$)/gi;
    for (const m of content.matchAll(thoughtRegex)) {
      if (m[1] && m[1].trim()) {
        thoughts.push(m[1].trim());
      }
    }
    const mainContent = content.replace(thoughtRegex, '').trim();
    return { thoughts, mainContent };
  } else {
    const thoughtRegex = /<think>([\s\S]*?)<\/think>/gi;
    let textWithoutThinking = content;
    const matches = Array.from(content.matchAll(thoughtRegex));
    for (const match of matches) {
      if (match[1] && match[1].trim()) {
        thoughts.push(match[1].trim());
      }
      textWithoutThinking = textWithoutThinking.replace(match[0], '');
    }
    return { thoughts, mainContent: textWithoutThinking.trim() };
  }
}
