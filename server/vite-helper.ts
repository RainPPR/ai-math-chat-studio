import { createServer } from 'vite';

export async function createViteServer() {
  return createServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
}
