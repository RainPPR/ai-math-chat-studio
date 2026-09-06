/**
 * Utilities for handling <think> blocks in message content.
 */

/**
 * Global regex matching <think>...</think> blocks, including unclosed <think>... blocks.
 */
export const THINK_REGEX = /<think>(?:[\s\S]*?)(?:<\/think>|$)/gi;

/**
 * Strips all <think>...</think> blocks (closed or unclosed) from content.
 */
export function stripThinking(content: string): string {
  if (!content) return '';
  return content.replace(THINK_REGEX, '').trim();
}

/**
 * Extracts thinking processes and main text content from a message.
 */
export function extractThinkingBlocks(content: string): { thoughts: string[]; mainContent: string } {
  if (!content) return { thoughts: [], mainContent: '' };
  const thoughts: string[] = [];
  const thoughtRegex = /<think>(?:\r?\n)?([\s\S]*?)(?:(?:\r?\n)?<\/think>(?:\r?\n)*|$)/gi;
  for (const m of content.matchAll(thoughtRegex)) {
    if (m[1] && m[1].trim()) {
      thoughts.push(m[1].trim());
    }
  }
  const mainContent = content.replace(thoughtRegex, '').trim();
  return { thoughts, mainContent };
}
