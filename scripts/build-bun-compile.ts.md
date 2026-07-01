```typescript
import { $ } from 'bun';
import {
  readFileSync,
  readdirSync,
  statSync,
  mkdirSync,
  existsSync,
  writeFileSync,
  unlinkSync,
} from 'fs';
import { join, relative, dirname } from 'path';

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

console.log('[1/4] Building frontend with Vite...');
const viteBuild = await $`bunx vite build`.quiet();
if (viteBuild.exitCode !== 0) {
  console.error('Vite build failed:', viteBuild.stderr.toString());
  process.exit(1);
}

console.log('[2/4] Reading dist/ assets for embedding...');
const distFiles = walkDir('dist');
const totalBytes = distFiles.reduce((s, f) => s + f.content.length, 0);
console.log(`  ${distFiles.length} files, ${(totalBytes / 1024).toFixed(0)} KB total`);

const assetsJson = JSON.stringify(
  Object.fromEntries(distFiles.map(f => [f.path, f.content.toString('base64')]))
);

console.log('[3/4] Creating server entry with embedded assets...');
if (!existsSync('release')) mkdirSync('release', { recursive: true });

// Create a server entry that embeds assets directly (in root dir for correct path resolution)
const serverEntryCode = `import 'dotenv/config';
import { mkdtempSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';

const ASSETS = ${assetsJson};

const tempDir = mkdtempSync(join(tmpdir(), 'ai-math-'));
for (const [relPath, b64] of Object.entries(ASSETS)) {
  const fullPath = join(tempDir, relPath);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, Buffer.from(b64, 'base64'));
}
process.env.DIST_DIR = tempDir;

import('./server/app.ts').then(({ startApp }) => startApp());
`;

const entryFile = 'server-compile-entry.ts';
writeFileSync(entryFile, serverEntryCode);

console.log('[4/4] Compiling to standalone executable with Bun...');

// Use Bun.build with compile option for cross-platform executable
const result = await Bun.build({
  entrypoints: [`./${entryFile}`],
  compile: {
    target: 'bun-windows-x64',
    outfile: './release/ai-math-chat-studio.exe',
  },
  minify: true,
  sourcemap: 'linked',
  bytecode: true,
  define: {
    'process.env.NODE_ENV': '"production"',
  },
});

if (!result.success) {
  console.error('Build failed:');
  for (const log of result.logs) {
    console.error(log);
  }
  // Clean up entry file
  try {
    unlinkSync(entryFile);
  } catch {}
  process.exit(1);
}

// Clean up intermediate files
try {
  unlinkSync(entryFile);
} catch {}

console.log('\nDone! Executable: release/ai-math-chat-studio.exe');
console.log('Run: ./release/ai-math-chat-studio.exe');

```