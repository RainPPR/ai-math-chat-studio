import fs from 'fs';
import path from 'path';

const DIST_DIR = 'context7-dist';

// Helper to ensure directory exists
function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Clear dist directory
if (fs.existsSync(DIST_DIR)) {
  fs.rmSync(DIST_DIR, { recursive: true, force: true });
}
ensureDir(DIST_DIR);

/**
 * Part 1: Process docs/*.md into documentation.md
 */
function processDocs() {
  const docsDir = 'docs';
  if (!fs.existsSync(docsDir)) return;
  const files = fs.readdirSync(docsDir).filter(f => f.endsWith('.md') && fs.statSync(path.join(docsDir, f)).isFile());
  let consolidatedContent = '';

  for (const file of files) {
    const content = fs.readFileSync(path.join(docsDir, file), 'utf-8');
    const lines = content.split('\n');
    let currentHeadings: string[] = [];
    let currentBlock: string[] = [];

    const flushBlock = () => {
      if (currentBlock.length > 0) {
        const title = currentHeadings.join(' / ');
        let blockContent = currentBlock.join('\n').trim();
        // Remove existing code block markers
        blockContent = blockContent.replace(/\`\`\`[a-z]*\n/gi, '').replace(/\n\`\`\`/g, '');
        
        consolidatedContent += `### ${title}\n\n\`\`\`text\n${blockContent}\n\`\`\`\n\n`;
        currentBlock = [];
      }
    };

    for (const line of lines) {
      const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
      if (headingMatch) {
        flushBlock();
        const level = headingMatch[1].length;
        const title = headingMatch[2].trim();
        currentHeadings = currentHeadings.slice(0, level - 1);
        currentHeadings[level - 1] = title;
      } else {
        currentBlock.push(line);
      }
    }
    flushBlock();
  }

  fs.writeFileSync(path.join(DIST_DIR, 'documentation.md'), consolidatedContent);
  console.log('Generated documentation.md');
}

/**
 * Part 2: Process scripts, server, src, .github, README.md
 */
function processSource() {
  const targets = ['scripts', 'server', 'src', '.github', 'README.md'];
  const extToLang: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.json': 'json',
    '.css': 'css',
    '.html': 'html',
    '.md': 'markdown',
    '.yml': 'yaml',
    '.yaml': 'yaml'
  };

  const processFile = (fullPath: string) => {
    const ext = path.extname(fullPath);
    const lang = extToLang[ext] || 'text';
    const content = fs.readFileSync(fullPath, 'utf-8');

    let relativePath = path.relative('.', fullPath).replace(/\\/g, '/');

    // Path transformation to avoid .github permission issues in the destination branch
    if (relativePath.startsWith('.github/workflows/')) {
      relativePath = relativePath.replace('.github/workflows/', 'workflow/');
    } else if (relativePath.startsWith('.github/')) {
      relativePath = relativePath.replace('.github/', 'github/');
    }

    const targetDir = path.join(DIST_DIR, path.dirname(relativePath));
    ensureDir(targetDir);

    const targetPath = path.join(DIST_DIR, `${relativePath}.md`);

    // Find maximum number of consecutive backticks to safely wrap content
    const backtickMatches = content.match(/\`{3,}/g);
    const backticks = backtickMatches
      ? '\`'.repeat(Math.max(...backtickMatches.map(m => m.length)) + 1)
      : '\`\`\`';

    const mdContent = `${backticks}${lang}\n${content}\n${backticks}`;
    fs.writeFileSync(targetPath, mdContent);
  };

  const walk = (currentDir: string) => {
    const files = fs.readdirSync(currentDir);
    for (const file of files) {
      const fullPath = path.join(currentDir, file);
      if (fs.statSync(fullPath).isDirectory()) {
        walk(fullPath);
      } else {
        processFile(fullPath);
      }
    }
  };

  for (const target of targets) {
    if (!fs.existsSync(target)) continue;

    if (fs.statSync(target).isDirectory()) {
      walk(target);
    } else {
      processFile(target);
    }
  }
  console.log('Generated source markdown files');
}

processDocs();
processSource();
