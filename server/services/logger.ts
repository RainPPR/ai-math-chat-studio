import fs from 'fs';
import path from 'path';
import { format } from 'util';

export function initLogger(logDir: string) {
  const originalLog = console.log;
  const originalInfo = console.info;
  const originalWarn = console.warn;
  const originalError = console.error;

  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');

  const fileName = `${year}-${month}-${day}.log`;
  const filePath = path.join(logDir, fileName);

  const logStream = fs.createWriteStream(filePath, { flags: 'a' });

  logStream.on('error', (err) => {
    originalError('[Logger] Failed to write to log file:', err);
  });

  const writeToLog = (level: string, args: any[]) => {
    const timestamp = new Date().toISOString();
    const message = format(...args);
    logStream.write(`[${timestamp}] [${level}] ${message}\n`);
  };

  console.log = (...args: any[]) => {
    writeToLog('LOG', args);
    originalLog(...args);
  };

  console.info = (...args: any[]) => {
    writeToLog('INFO', args);
    originalInfo(...args);
  };

  console.warn = (...args: any[]) => {
    writeToLog('WARN', args);
    originalWarn(...args);
  };

  console.error = (...args: any[]) => {
    writeToLog('ERROR', args);
    originalError(...args);
  };

  console.log(`[Logger] Logging to ${filePath}`);
}
