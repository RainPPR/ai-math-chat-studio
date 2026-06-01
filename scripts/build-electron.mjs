import { execSync } from 'child_process';
import { mkdirSync, existsSync, cpSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';

const buildDir = 'build-electron';

if (!existsSync('dist-server/server.bundle.mjs')) {
  console.error('dist-server/server.bundle.mjs not found. Run: node scripts/build-bundle.mjs');
  process.exit(1);
}

console.log('[1/2] Preparing Electron app directory...');
if (existsSync(buildDir)) rmSync(buildDir, { recursive: true, force: true });
mkdirSync(buildDir, { recursive: true });

cpSync('electron/main.cjs', join(buildDir, 'main.cjs'));
cpSync('dist-server', join(buildDir, 'dist-server'), { recursive: true });

writeFileSync(join(buildDir, 'package.json'), JSON.stringify({
  name: 'ai-math-chat-studio',
  version: '1.0.0',
  main: 'main.cjs',
  description: 'AI Math & Chat Studio',
}, null, 2));

console.log('[2/2] Running electron-builder...');
execSync('npx electron-builder --win --config electron-builder.yml', {
  stdio: 'inherit',
  env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: 'false' },
});

console.log('\nElectron build complete! Output: release/');
