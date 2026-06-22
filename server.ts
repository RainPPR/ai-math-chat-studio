import 'dotenv/config';
import { startApp } from './server/app';

// Main entry point - start server immediately
startApp().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
