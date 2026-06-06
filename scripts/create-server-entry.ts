import {
  readFileSync,
  readdirSync,
  statSync,
  mkdirSync,
  existsSync,
  writeFileSync,
} from 'fs';
import { join, relative } from 'path';

function walkDir(dir: string, base = dir): { path: string; content: Buffer }[] {
  const files: { path: string; content: Buffer }[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = relative(base, full).replace(/\\/g, '/');
    if (statSync(full).isDirectory()) {
      files.push(...walkDir(full, base));
    } else {
      files.push({ path: rel, content: readFileSync(full) });
    }
  }
  return files;
}

if (!existsSync('dist-compile')) mkdirSync('dist-compile', { recursive: true });

const distFiles = walkDir('dist');
const assets = Object.fromEntries(
  distFiles.map(f => [f.path, f.content.toString('base64')])
);

const code = `import 'dotenv/config';
import { mkdtempSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';

const ASSETS = ${JSON.stringify(assets)};

const tempDir = mkdtempSync(join(tmpdir(), 'ai-math-'));
for (const [relPath, b64] of Object.entries(ASSETS)) {
  const fullPath = join(tempDir, relPath);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, Buffer.from(b64, 'base64'));
}
process.env.DIST_DIR = tempDir;

import('./server/app.ts').then(({ startApp }) => startApp());
`;

writeFileSync('dist-compile/server-entry.ts', code);
console.log('Created dist-compile/server-entry.ts');
