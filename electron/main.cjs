const { app, BrowserWindow, shell } = require('electron');
const { spawn } = require('child_process');
const path = require('path');

let mainWindow = null;
let serverProcess = null;

function resolveServerPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'server', 'server.bundle.mjs');
  }
  return path.join(__dirname, '..', 'dist-server', 'server.bundle.mjs');
}

function startServer() {
  return new Promise((resolve, reject) => {
    const serverPath = resolveServerPath();
    const userDataPath = app.getPath('userData');

    serverProcess = spawn(process.execPath, [serverPath], {
      env: {
        ...process.env,
        PORT: '0',
        NODE_ENV: 'production',
        ELECTRON_RUN_AS_NODE: '1',
      },
      cwd: userDataPath,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let resolved = false;
    let stdout = '';

    serverProcess.stdout.on('data', (data) => {
      stdout += data.toString();
      const match = stdout.match(/Server running on http:\/\/localhost:(\d+)/);
      if (match && !resolved) {
        resolved = true;
        resolve(parseInt(match[1], 10));
      }
    });

    serverProcess.stderr.on('data', (data) => {
      process.stderr.write(data);
    });

    serverProcess.on('error', (err) => {
      if (!resolved) { resolved = true; reject(err); }
    });

    serverProcess.on('exit', (code) => {
      if (!resolved) {
        resolved = true;
        reject(new Error(`Server exited with code ${code}`));
      }
    });
  });
}

function createWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    title: 'AI Math & Chat Studio',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadURL(`http://127.0.0.1:${port}`);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  try {
    const port = await startServer();
    createWindow(port);
  } catch (err) {
    console.error('Failed to start server:', err);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill();
  }
  app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) {
    // On macOS, re-create window from dock
  }
});
