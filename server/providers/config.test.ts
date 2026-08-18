import { describe, expect, test } from 'bun:test';
import { MATH_INSTRUCTIONS } from './config';

describe('MATH_INSTRUCTIONS', () => {
  test('contains KaTeX block math environment instructions and few-shot examples', () => {
    expect(MATH_INSTRUCTIONS).toContain('$$\\begin{aligned}');
    expect(MATH_INSTRUCTIONS).toContain('\\end{aligned}$$');
    expect(MATH_INSTRUCTIONS).toContain('$$\n\\begin{aligned}');
    expect(MATH_INSTRUCTIONS).toContain('\\end{aligned}\n$$');
    expect(MATH_INSTRUCTIONS).toContain('Incorrect format:');
    expect(MATH_INSTRUCTIONS).toContain('Correct format:');
  });
});
