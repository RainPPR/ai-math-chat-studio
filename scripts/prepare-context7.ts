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
        blockContent = blockContent.replace(/```[a-z]*\n/gi, '').replace(/\n```/g, '');
        
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
 * Part 2: Process scripts, server, src
 */
function processSource() {
  const dirs = ['scripts', 'server', 'src'];
  const extToLang: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.json': 'json',
    '.css': 'css',
    '.html': 'html',
    '.md': 'markdown'
  };

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;

    const walk = (currentDir: string) => {
      const files = fs.readdirSync(currentDir);
      for (const file of files) {
        const fullPath = path.join(currentDir, file);
        if (fs.statSync(fullPath).isDirectory()) {
          walk(fullPath);
        } else {
          const ext = path.extname(file);
          const lang = extToLang[ext] || 'text';
          const content = fs.readFileSync(fullPath, 'utf-8');
          
          const relativePath = path.relative('.', fullPath);
          const targetDir = path.join(DIST_DIR, path.dirname(relativePath));
          ensureDir(targetDir);
          
          const targetPath = path.join(DIST_DIR, `${relativePath}.md`);
          const mdContent = `\`\`\`${lang}\n${content}\n\`\`\``;
          fs.writeFileSync(targetPath, mdContent);
        }
      }
    };
    walk(dir);
  }
  console.log('Generated source markdown files');
}

/**
 * Part 3: Process sessions
 */
function processSessions() {
  const sessionsDir = 'data/sessions';
  if (!fs.existsSync(sessionsDir)) return;

  const targetDataDir = path.join(DIST_DIR, 'data');
  ensureDir(targetDataDir);

  const files = fs.readdirSync(sessionsDir).filter(f => f.endsWith('.json'));

  for (const file of files) {
    const session = JSON.parse(fs.readFileSync(path.join(sessionsDir, file), 'utf-8'));
    const uuid = path.basename(file, '.json');
    
    let mdContent = `# ${session.title || 'Untitled Session'}\n\n`;
    
    if (session.messages && Array.isArray(session.messages)) {
      for (const msg of session.messages) {
        mdContent += `## ${msg.role}\n\n\`\`\`text\n${msg.role}/${msg.createdAt}\n\n${msg.content}\n\`\`\`\n\n`;
      }
    }

    fs.writeFileSync(path.join(targetDataDir, `${uuid}.md`), mdContent);
  }
  console.log('Generated session markdown files');
}

processDocs();
processSource();
processSessions();
