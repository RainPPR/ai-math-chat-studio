import { build } from 'esbuild';
import { execSync } from 'child_process';
import { readFileSync, readdirSync, statSync, mkdirSync, existsSync, copyFileSync } from 'fs';
import { join, relative, dirname } from 'path';

function walkDir(dir, base = dir) {
  const files = [];
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
execSync('npx vite build', { stdio: 'inherit' });

console.log('[2/3] Reading dist/ assets for embedding...');
const distFiles = walkDir('dist');
const totalBytes = distFiles.reduce((s, f) => s + f.content.length, 0);
console.log(`  ${distFiles.length} files, ${(totalBytes / 1024).toFixed(0)} KB total`);

const assetsJson = JSON.stringify(
  Object.fromEntries(distFiles.map(f => [f.path, f.content.toString('base64')]))
);

console.log('[3/3] Bundling server with esbuild...');
if (!existsSync('dist-server')) mkdirSync('dist-server', { recursive: true });

const wrapperCode = [
  `import { mkdtempSync, writeFileSync, mkdirSync } from 'fs';`,
  `import { join, dirname } from 'path';`,
  `import { tmpdir } from 'os';`,
  ``,
  `const ASSETS = ${assetsJson};`,
  ``,
  `const tempDir = mkdtempSync(join(tmpdir(), 'ai-math-'));`,
  `for (const [relPath, b64] of Object.entries(ASSETS)) {`,
  `  const fullPath = join(tempDir, relPath);`,
  `  mkdirSync(dirname(fullPath), { recursive: true });`,
  `  writeFileSync(fullPath, Buffer.from(b64, 'base64'));`,
  `}`,
  `process.env.DIST_DIR = tempDir;`,
  ``,
  `await import('./server.ts');`,
].join('\n');

await build({
  stdin: {
    contents: wrapperCode,
    resolveDir: process.cwd(),
    loader: 'js',
  },
  bundle: true,
  minify: true,
  outfile: 'dist-server/server.bundle.mjs',
  platform: 'node',
  format: 'esm',
  target: 'node20',
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  external: ['vite'],
  banner: {
    js: `import { createRequire } from 'module'; const require = createRequire(import.meta.url);`,
  },
  logLevel: 'info',
});

if (existsSync('.env.example')) {
  copyFileSync('.env.example', 'dist-server/.env.example');
}

const outSize = statSync('dist-server/server.bundle.mjs').size;
console.log(`\nDone! dist-server/server.bundle.mjs (${(outSize / 1024 / 1024).toFixed(1)} MB)`);
console.log('Run: node dist-server/server.bundle.mjs');
