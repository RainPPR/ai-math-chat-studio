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
  const hours = String(now.getUTCHours()).padStart(2, '0');
  const minutes = String(now.getUTCMinutes()).padStart(2, '0');
  const seconds = String(now.getUTCSeconds()).padStart(2, '0');

  const dateStr = `${year}-${month}-${day}`;
  const timeStr = `${hours}${minutes}${seconds}`;

  // Determine the next index for the current day
  const files = fs.readdirSync(logDir);
  const dayLogRegex = new RegExp(`^${dateStr}-\\d{6}-(\\d+)\\.log$`);

  let maxIndex = 0;
  for (const file of files) {
    const match = file.match(dayLogRegex);
    if (match) {
      const index = parseInt(match[1], 10);
      if (index > maxIndex) {
        maxIndex = index;
      }
    }
  }

  const nextIndex = maxIndex + 1;
  const fileName = `${dateStr}-${timeStr}-${nextIndex}.log`;
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
