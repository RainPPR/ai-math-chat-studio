```css
@import "tailwindcss";
@plugin "@tailwindcss/typography";

@import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@300..700&family=Noto+Sans+SC:wght@100..900&display=swap');

@font-face {
  font-family: 'FullWidthQuotes';
  src: url('./fonts/Noto Sans SC-Variable-subset.woff2') format('woff2');
  font-weight: 200 900;
  font-style: normal;
  unicode-range: U+2018, U+2019, U+201C, U+201D;
  font-display: swap;
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
   CJK / 中文字符彻底修复
   ========================================================= */
.katex .cjk_fallback,
mjx-container .cjk_fallback,
.MathJax .cjk_fallback {
  font-family: var(--font-main) !important;
}

/* =========================================================
   MathJax: 彻底隐藏并禁用无障碍 Explorer 帮助弹窗与上下文菜单
   ========================================================= */
.CtxtMenu_Info,
.CtxtMenu_MenuFrame,
.CtxtMenu_Overlay,
.CtxtMenu_Global,
.CtxtMenu_Attached_Info,
[class*="CtxtMenu_"],
dialog.mjx-dialog-help,
dialog[class*="mjx-dialog"],
.mjx-dialog,
mjx-dialog,
mjx-explorer,
.MathJax_Menu,
.MathJax_MenuFrame,
.MathJax_About,
#MathJax_About {
  display: none !important;
  visibility: hidden !important;
  pointer-events: none !important;
  opacity: 0 !important;
}

/* =========================================================
   MathJax 行内公式基线对齐修复
   ========================================================= */
.math-inline-wrapper {
  display: inline !important;
  vertical-align: baseline !important;
}

.math-inline-wrapper > mjx-container,
.math-inline-wrapper > .MathJax {
  display: inline-block !important;
}


```