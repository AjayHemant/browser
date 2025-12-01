// main.js

// Modules to control application life and create native browser window
const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const { ElectronBlocker } = require('@ghostery/adblocker-electron');
const fetch = require('cross-fetch');

function createWindow() {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      // The preload script is a bridge between the Node.js world (main process)
      // and the web page world (renderer process).
      preload: path.join(__dirname, 'preload.js'),
      webviewTag: true, // Enable <webview> tag
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // --- Block Pop-up Windows ---
  // Intercept any attempt to open a new window (like window.open or target="_blank")
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    console.log(`Blocking pop-up request to: ${url}`);
    return { action: 'deny' };
  });

  // Load the Flask app
  // We wait a bit for Flask to start in run.sh
  mainWindow.loadURL('http://127.0.0.1:5000').catch(err => {
    console.error('Failed to load Flask app:', err);
    // Retry once after 2 seconds
    setTimeout(() => {
      mainWindow.loadURL('http://127.0.0.1:5000').catch(e => console.error('Retry failed:', e));
    }, 2000);
  });

  // Remove the default menu bar (File, Edit, View, etc.)
  mainWindow.removeMenu();

  // Open the DevTools for debugging if you want.
  // mainWindow.webContents.openDevTools();

  // Listen for the 'navigate-to' event from the renderer process
  ipcMain.on('navigate-to', (event, url) => {
    mainWindow.webContents.loadURL(url);
  });

  // Handle new incognito window
  ipcMain.on('new-incognito-window', () => {
    const incognitoWindow = new BrowserWindow({
      width: 1280,
      height: 800,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        webviewTag: true,
        partition: 'incognito' // Use a temporary partition for the window itself
      },
    });

    incognitoWindow.loadURL('http://127.0.0.1:5000/?incognito=true');
    incognitoWindow.removeMenu();
  });

  // Handle window close event - warn about incognito tabs
  let isClosing = false;
  mainWindow.on('close', async (e) => {
    if (isClosing) return;

    e.preventDefault();

    try {
      const hasIncognitoTabs = await mainWindow.webContents.executeJavaScript(
        'typeof state !== "undefined" && state.tabs ? state.tabs.some(tab => tab.isIncognito) : false'
      ).catch(() => false); // Catch error if state is undefined

      if (hasIncognitoTabs) {
        const { dialog } = require('electron');
        const choice = dialog.showMessageBoxSync(mainWindow, {
          type: 'warning',
          buttons: ['Cancel', 'Close Anyway'],
          title: 'Incognito Tabs Open',
          message: 'You have incognito tabs open. They will be closed and not saved.',
          defaultId: 0,
          cancelId: 0
        });

        if (choice === 1) {
          isClosing = true;
          mainWindow.close();
        }
      } else {
        isClosing = true;
        mainWindow.close();
      }
    } catch (err) {
      console.error('Error checking incognito tabs:', err);
      isClosing = true;
      mainWindow.close();
    }
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Page failed to load:', errorCode, errorDescription);
  });

  mainWindow.webContents.on('crashed', () => {
    console.error('Renderer process crashed!');
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(async () => {
  // --- Initialize Ad-Blocker ---
  let blocker = null;
  let adBlockEnabled = true; // Default to enabled
  let blockedCount = 0;

  try {
    blocker = await ElectronBlocker.fromPrebuiltAdsAndTracking(fetch);
    console.log('Ad-blocker initialized successfully');

    // Enable blocker by default
    blocker.enableBlockingInSession(session.defaultSession);

    // Track blocked requests
    blocker.on('request-blocked', (request) => {
      blockedCount++;
      console.log('Blocked:', request.url);
    });
  } catch (error) {
    console.error('Failed to initialize ad-blocker:', error);
  }

  // IPC handlers for ad-blocker
  ipcMain.handle('adblocker-toggle', async (event, enabled) => {
    if (!blocker) return { success: false, error: 'Ad-blocker not initialized' };

    adBlockEnabled = enabled;

    if (enabled) {
      blocker.enableBlockingInSession(session.defaultSession);
      console.log('Ad-blocker enabled');
    } else {
      blocker.disableBlockingInSession(session.defaultSession);
      console.log('Ad-blocker disabled');
    }

    return { success: true, enabled: adBlockEnabled };
  });

  ipcMain.handle('adblocker-stats', async () => {
    return {
      enabled: adBlockEnabled,
      blockedCount: blockedCount,
      hasBlocker: blocker !== null
    };
  });

  ipcMain.handle('adblocker-reset-count', async () => {
    blockedCount = 0;
    return { success: true };
  });

  // --- Block Insecure HTTP Requests ---
  // This will cancel any top-level navigation to an http:// URL, except for localhost.
  session.defaultSession.webRequest.onBeforeRequest({
    urls: ['http://*/*']
  }, (details, callback) => {
    const url = details.url;
    if (details.resourceType === 'mainFrame' &&
      !url.includes('localhost') &&
      !url.includes('127.0.0.1')) {
      console.log(`Blocking insecure navigation to: ${url}`);
      callback({ cancel: true }); // Block the request
    } else {
      callback({ cancel: false }); // Allow other requests
    }
  });

  // --- Handle Downloads ---
  session.defaultSession.on('will-download', (event, item, webContents) => {
    const filePath = item.getSavePath();

    item.once('done', (event, state) => {
      if (state === 'completed') {
        // Send download info to renderer
        // We need to send this to the main window, or the webContents that initiated it
        // Since the UI is in the main window, we should send it there.
        // However, webContents here is the one that initiated the download.
        // If the download came from a <webview>, we might need to forward it to the host page.

        // Find the main window to send the event to
        const windows = BrowserWindow.getAllWindows();
        const mainWindow = windows[0]; // Assuming the first one is the main one

        if (mainWindow) {
          mainWindow.webContents.send('download-completed', {
            filename: item.getFilename(),
            file_path: filePath,
            file_size: item.getTotalBytes(),
            mime_type: item.getMimeType(),
            source_url: item.getURL()
          });
        }
      }
    });
  });

  // --- Handle Show Item In Folder ---
  ipcMain.on('show-item-in-folder', (event, filePath) => {
    const { shell } = require('electron');
    shell.showItemInFolder(filePath);
  });

  // --- Handle Open External URL ---
  ipcMain.on('open-external', (event, url) => {
    require('electron').shell.openExternal(url);
  });

  createWindow();

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});
