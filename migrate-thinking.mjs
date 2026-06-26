import fs from 'fs';
import path from 'path';

function replaceInFile(filePath, replacements) {
  const fullPath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(fullPath)) {
    console.warn(`⚠️ 未找到文件: ${fullPath}`);
    return;
  }
  let code = fs.readFileSync(fullPath, 'utf8');
  
  // 将换行符标准化为 LF，以确保跨平台匹配精确无误
  const isCRLF = code.includes('\r\n');
  code = code.replace(/\r\n/g, '\n');

  let changed = false;
  for (const [search, replace] of replacements) {
    if (code.includes(search)) {
      code = code.split(search).join(replace);
      changed = true;
    } else {
      console.warn(`[跳过] 在 ${filePath} 中未找到目标字符串 (可能已修改过)。\n片段: ${search.substring(0, 30)}...`);
    }
  }

  if (changed) {
    // 恢复文件原本的换行符
    if (isCRLF) {
      code = code.replace(/\n/g, '\r\n');
    }
    fs.writeFileSync(fullPath, code);
    console.log(`✅ 已成功更新文件: ${filePath}`);
  }
}

// 1. 修改 Generation Manager
replaceInFile('server/services/generation-manager.ts', [
  [
    " *   <details>\\n<summary>Thinking Process</summary>\\n\\n```text\\nline 1\\nline 2\\n...\\n```\\n\\n</details>\\n\\n(content)",
    " *   <think>\\nline 1\\nline 2\\n...\\n</think>\\n\\n(content)"
  ],
  [
    "  const standardThinking = `<details>\\n<summary>Thinking Process</summary>\\n\\n\\`\\`\\`text\\n${thinkingContent}\\n\\`\\`\\`\\n\\n</details>\\n\\n${mainContent}`;",
    "  const standardThinking = `<think>\\n${thinkingContent}\\n</think>\\n\\n${mainContent}`;"
  ],
  [
    "    const thoughtRegex = /<details(?: open)?>\\n<summary>Thinking Process<\\/summary>\\n\\n```text\\n([\\s\\S]*?)(?:\\n```\\n\\n<\\/details>|$)/;",
    "    const thoughtRegex = /<think>(?:\\r?\\n)?([\\s\\S]*?)(?:(?:\\r?\\n)?<\\/think>|$)/;"
  ],
  [
    "      cleanedContent = `<details open>\\n<summary>Thinking Process</summary>\\n\\n\\`\\`\\`text\\n${match[1].trim()}\\n\\`\\`\\`\\n\\n</details>\\n\\n`;",
    "      cleanedContent = `<think>\\n${match[1].trim()}\\n</think>\\n\\n`;"
  ],
  [
    "            fullContent += '<details open>\\n<summary>Thinking Process</summary>\\n\\n```text\\n';",
    "            fullContent += '<think>\\n';"
  ],
  [
    "            fullContent += '\\n```\\n\\n</details>\\n\\n';",
    "            fullContent += '\\n</think>\\n\\n';"
  ],
  [
    "      fullContent += '\\n```\\n\\n</details>\\n\\n';",
    "      fullContent += '\\n</think>\\n\\n';"
  ],
  [
    "    fullContent = fullContent.replace(/<details open>/g, '<details>');",
    ""
  ]
]);

// 2. 修改 API Request Stream
replaceInFile('server/providers/stream.ts', [
  [
    " * Converts: <details>\\n<summary>Thinking Process</summary>\\n\\n```text\\n...\\n```\\n\\n</details>\\n\\n(content)",
    " * Converts: <think>\\n...\\n</think>\\n\\n(content)"
  ],
  [
    "  const thinkingRegex = /<details(?:\\s+open)?>\\s*<summary>Thinking\\s+Process<\\/summary>\\s*```text\\n([\\s\\S]*?)\\n```\\s*<\\/details>\\s*(?:\\r?\\n)*/gi;",
    "  const thinkingRegex = /<think>(?:\\r?\\n)?([\\s\\S]*?)(?:\\r?\\n)?<\\/think>(?:\\r?\\n)*/gi;"
  ]
]);

// 3. 修改前端展示组件 ChatArea
replaceInFile('src/components/ChatArea.tsx', [
  [
    " * Standard: <details>\\n<summary>Thinking Process</summary>\\n\\n```text\\nline1\\nline2\\n...\\n```\\n\\n</details>\\n\\ncontent",
    " * Standard: <think>\\nline1\\nline2\\n...\\n</think>\\n\\ncontent"
  ],
  [
    "      // Standard format: parse existing <details> blocks\n      const thoughtRegex = /<details(?: open)?>\\n<summary>Thinking Process<\\/summary>\\n\\n```text\\n([\\s\\S]*?)(?:\\n```\\n\\n<\\/details>|$)/g;",
    "      // Standard format: parse existing <think> blocks\n      const thoughtRegex = /<think>(?:\\r?\\n)?([\\s\\S]*?)(?:(?:\\r?\\n)?<\\/think>(?:\\r?\\n)*|$)/g;"
  ],
  [
    "  if (lastMsg && lastMsg.role === 'model' && streamingContent) {\n    const normalizedSaved = lastMsg.content.replace(/<details>/g, '<details open>');\n    const normalizedStream = streamingContent.replace(/<details>/g, '<details open>');\n    isStreamSaved = normalizedSaved.includes(normalizedStream.substring(0, Math.min(normalizedStream.length, 500)));\n  }",
    "  if (lastMsg && lastMsg.role === 'model' && streamingContent) {\n    const normalizedSaved = lastMsg.content;\n    const normalizedStream = streamingContent;\n    isStreamSaved = normalizedSaved.includes(normalizedStream.substring(0, Math.min(normalizedStream.length, 500)));\n  }"
  ]
]);

// 4. 更新 /data/sessions/ 中的历史 JSON 数据
const sessionsDir = path.join(process.cwd(), 'data', 'sessions');
if (fs.existsSync(sessionsDir)) {
  const files = fs.readdirSync(sessionsDir);
  let updatedCount = 0;
  
  for (const file of files) {
    if (file.endsWith('.json')) {
      const filePath = path.join(sessionsDir, file);
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        let changed = false;
        
        if (data.messages && Array.isArray(data.messages)) {
          data.messages.forEach(msg => {
            if (msg.role === 'model' && msg.content) {
              // 匹配旧版 details 渲染格式
              const detailsRegex = /<details(?: open)?>\s*<summary>Thinking Process<\/summary>\s*```text\n([\s\S]*?)\n```\s*<\/details>(?:\r?\n)*/gi;
              
              const newContent = msg.content.replace(detailsRegex, (match, p1) => {
                return `<think>\n${p1.trim()}\n</think>\n\n`;
              });
              
              if (newContent !== msg.content) {
                msg.content = newContent;
                changed = true;
              }
            }
          });
        }
        
        if (changed) {
          fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
          updatedCount++;
        }
      } catch (err) {
        console.error(`❌ 解析数据文件出错: ${file}`, err);
      }
    }
  }
  console.log(`✅ 已完成修改：更新了 ${updatedCount} 个历史 Session JSON 文件的格式。`);
} else {
  console.warn('⚠️ /data/sessions 目录不存在，跳过历史数据迁移。');
}

console.log('\n🎉 所有任务修改完毕！你可以重新启动项目测试。');