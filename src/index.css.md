```css
@import "tailwindcss";
@plugin "@tailwindcss/typography";

@import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@300..700&family=Noto+Sans+SC:wght@100..900&display=swap');

@font-face {
  font-family: 'Euler Math';
  src: url('./fonts/Euler-Math.woff2') format('woff2'),
    url('./fonts/Euler-Math.otf') format('opentype');
  font-weight: normal;
  font-style: normal;
}

@font-face {
  font-family: 'Fira Math';
  src: url('./fonts/FiraMath-Regular.woff2') format('woff2'),
    url('./fonts/FiraMath-Regular.otf') format('opentype');
  font-weight: normal;
  font-style: normal;
}

@font-face {
  font-family: 'Cambria Math';
  src: url('./fonts/Cambria Math.woff2') format('woff2'),
    url('./fonts/Cambria Math.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
}

@font-face {
  font-family: 'FullWidthQuotes';
  src: url('./fonts/Noto Serif SC-Variable-subset.woff2') format('woff2');
  font-weight: 200 900;
  font-style: normal;
  unicode-range: U+2018, U+2019, U+201C, U+201D;
  font-display: swap;
}

/* =========================================================
   1. 使用 CSS 原生变量管理数学字体，大幅简化代码
   ========================================================= */
.katex-font-euler {
  --katex-math-font: 'Euler Math', 'KaTeX_Main', serif;
}

.katex-font-fira {
  --katex-math-font: 'Fira Math', 'KaTeX_Main', sans-serif;
}

.katex-font-cambria {
  --katex-math-font: 'Cambria Math', 'KaTeX_Main', serif;
}

:root {
  /* 从头 Noto Serif 提取的 “”‘’
  然后是 Noto Sans、Noto Sans SC */
  --font-main:
    FullWidthQuotes,
    'Noto Sans SC',
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    sans-serif;
}

@theme {
  --font-sans: var(--font-main);
  --font-mono: "Fira Code", monospace;
}

/* =========================================================
   2. 统一覆盖 KaTeX 内部数学节点
   ========================================================= */
/* 兼容 katex-font- 类无论加在父元素还是 .katex 本身 */
.katex :is(.mbin, .mrel, .merl, .mopen, .mclose, .mpunct, .minner, .mord, .text):not(.cjk_fallback):not(:has(.cjk_fallback)) {
  font-family: var(--katex-math-font) !important;
}

/* =========================================================
   3. CJK / 中文字符彻底修复 (关键：重置斜体与字距)
   ========================================================= */
.katex .cjk_fallback {
  font-family: var(--font-main) !important;
}
```