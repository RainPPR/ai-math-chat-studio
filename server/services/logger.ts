import fs from 'fs';
import path from 'path';
import { format } from 'util';

export function initLogger(logDir: string) {
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  const dateStr = `${year}-${month}-${day}`;
  const timeStr = `${hours}${minutes}${seconds}`;

  const files = fs.readdirSync(logDir);
  const todayPrefix = dateStr;
  const index = files.filter(f => f.startsWith(todayPrefix)).length + 1;

  const fileName = `${dateStr}-${timeStr}-${index}.log`;
  const filePath = path.join(logDir, fileName);

  const logStream = fs.createWriteStream(filePath, { flags: 'a' });

  const originalLog = console.log;
  const originalInfo = console.info;
  const originalWarn = console.warn;
  const originalError = console.error;

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
