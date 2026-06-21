import 'dotenv/config';
import { convert } from 'pandoc-wasm';
import { startApp } from './server/app';

// Global pandoc-wasm warmup - runs immediately when this module is loaded
// This ensures WASM is fully initialized before any requests are handled
async function globalPandocWarmup(): Promise<void> {
  try {
    const start = Date.now();
    // Multiple calls to ensure WASM module is fully downloaded, compiled and cached
    await convert({ from: 'markdown', to: 'plain', standalone: true, wrap: 'none' }, 'warmup', {});
    await convert({ from: 'markdown', to: 'plain', standalone: true, wrap: 'none' }, 'warmup2', {});
    console.log(`[Global Warmup] pandoc-wasm ready in ${Date.now() - start}ms`);
  } catch (err) {
    console.error('[Global Warmup] pandoc-wasm warmup failed:', err);
  }
}

// Main entry point - wait for warmup then start server
async function main() {
  // Start warmup immediately and wait for it to complete before accepting requests
  await globalPandocWarmup();

  // Now start the server - pandoc is already warmed up
  await startApp();
}

main().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
