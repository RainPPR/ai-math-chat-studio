import { describe, expect, test } from 'bun:test';
import { FORMAT_INSTRUCTIONS } from './config';

describe('FORMAT_INSTRUCTIONS', () => {
  test('contains KaTeX block math environment instructions and few-shot examples', () => {
    expect(FORMAT_INSTRUCTIONS).toContain('$$\\begin{aligned}');
    expect(FORMAT_INSTRUCTIONS).toContain('\\end{aligned}$$');
    expect(FORMAT_INSTRUCTIONS).toContain('$$\n\\begin{aligned}');
    expect(FORMAT_INSTRUCTIONS).toContain('\\end{aligned}\n$$');
    expect(FORMAT_INSTRUCTIONS).toContain('Incorrect format:');
    expect(FORMAT_INSTRUCTIONS).toContain('Correct format:');
  });
});
