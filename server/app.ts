import express from 'express';
import path from 'path';
import { existsSync, mkdirSync } from 'fs';
import { createViteServer } from './vite-helper';
import { GenerationManager } from './services/generation-manager';
import { createSettingsRouter } from './routes/settings';
import { createSessionRouter } from './routes/sessions';
import { createChatRouter } from './routes/chat';
import { createModelsRouter } from './routes/models';

export async function startApp() {
  const app = express();
  const PORT = 3000;

  const DATA_DIR = path.join(process.cwd(), 'data');
  const SESSIONS_DIR = path.join(DATA_DIR, 'sessions');
  const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(SESSIONS_DIR)) mkdirSync(SESSIONS_DIR, { recursive: true });

  const gm = new GenerationManager(SESSIONS_DIR);

  app.use(express.json());

  app.use(createSettingsRouter(SETTINGS_FILE));
  app.use(createSessionRouter(gm));
  app.use(createChatRouter(gm, SETTINGS_FILE));
  app.use(createModelsRouter());

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer();
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(PORT, '127.0.0.1', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
