/**
 * Utilities for handling <think> blocks in message content.
 */

/**
 * Regex matching <think>...</think> blocks, including unclosed <think>... blocks.
 */
export const THINK_REGEX = /<think>(?:[\s\S]*?)(?:<\/think>|$)/gi;

/**
 * Strips all <think>...</think> blocks (closed or unclosed) from content.
 */
export function stripThinking(content: string): string {
  if (!content) return '';
  return content.replace(THINK_REGEX, '').trim();
}
