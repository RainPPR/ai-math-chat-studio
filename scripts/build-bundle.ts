import { $ } from 'bun';
import {
  readFileSync,
  readdirSync,
  statSync,
  mkdirSync,
  existsSync,
  copyFileSync,
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

console.log('[1/3] Building frontend with Vite...');
const viteBuild = await $`bunx vite build`.quiet();
if (viteBuild.exitCode !== 0) {
  console.error('Vite build failed:', viteBuild.stderr.toString());
  process.exit(1);
}

console.log('[2/3] Reading dist/ assets for embedding...');
const distFiles = walkDir('dist');
const totalBytes = distFiles.reduce((s, f) => s + f.content.length, 0);
console.log(`  ${distFiles.length} files, ${(totalBytes / 1024).toFixed(0)} KB total`);

const assetsJson = JSON.stringify(
  Object.fromEntries(distFiles.map(f => [f.path, f.content.toString('base64')]))
);

console.log('[3/3] Bundling server with Bun.build...');
if (!existsSync('dist-server')) mkdirSync('dist-server', { recursive: true });

// Build the server bundle using Bun.build
const result = await Bun.build({
  entrypoints: ['./server.ts'],
  outdir: 'dist-server',
  target: 'node',
  minify: true,
  sourcemap: 'linked',
  format: 'esm',
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  external: ['vite'],
});

if (!result.success) {
  console.error('Build failed:');
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}

// Find the built output file
const builtFile = result.outputs[0];
if (!builtFile) {
  console.error('No output file generated');
  process.exit(1);
}

// Read the built output
const builtOutput = await builtFile.text();

// Create the wrapper with assets extraction
const wrapperCode = `import { mkdtempSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const ASSETS = ${assetsJson};

const tempDir = mkdtempSync(join(tmpdir(), 'ai-math-'));
for (const [relPath, b64] of Object.entries(ASSETS)) {
  const fullPath = join(tempDir, relPath);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, Buffer.from(b64, 'base64'));
}
process.env.DIST_DIR = tempDir;

${builtOutput}
`;

// Write the final bundle
const outFile = 'dist-server/server.bundle.mjs';
writeFileSync(outFile, wrapperCode);

// Clean up intermediate file
try {
  unlinkSync(builtFile.path);
} catch {}

if (existsSync('.env.example')) {
  copyFileSync('.env.example', 'dist-server/.env.example');
}

const outSize = statSync(outFile).size;
console.log(`\nDone! ${outFile} (${(outSize / 1024 / 1024).toFixed(1)} MB)`);
console.log('Run: bun dist-server/server.bundle.mjs');
