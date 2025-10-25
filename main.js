// main.js

// Modules to control application life and create native browser window
const { ElectronBlocker } = require('@ghostery/adblocker-electron');
const { app, BrowserWindow, ipcMain, session } = require('electron');
const fetch = require('cross-fetch');
const path = require('path');

function createWindow() {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      // The preload script is a bridge between the Node.js world (main process)
      // and the web page world (renderer process).
      preload: path.join(__dirname, 'preload.js'),
      webviewTag: true, // <-- Add this line to enable the <webview> tag
    },
  });

  // --- Block Pop-up Windows ---
  // Intercept any attempt to open a new window (like window.open or target="_blank")
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    console.log(`Blocking pop-up request to: ${url}`);
    return { action: 'deny' };
  });

  // Load the index.html of the app. This is our browser's UI.
  mainWindow.loadFile('index.html');

  // Remove the default menu bar (File, Edit, View, etc.)
  mainWindow.removeMenu();

  // Open the DevTools for debugging if you want.
  // mainWindow.webContents.openDevTools();

  // Listen for the 'navigate-to' event from the renderer process
  ipcMain.on('navigate-to', (event, url) => {
    mainWindow.webContents.loadURL(url);
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(async () => {
  // --- Advanced Ad-Blocker Implementation ---
  // We are now using `fromLists` to load more specific filter lists
  // that help combat ad-blocker detection scripts and other annoyances.
  try {
    const blocker = await ElectronBlocker.fromLists(fetch, [
      'https://easylist.to/easylist/easylist.txt',
      'https://easylist.to/easylist/easyprivacy.txt',
      // This list is crucial for blocking "annoyances" like cookie notices,
      // newsletter pop-ups, and many anti-adblock scripts.
      'https://easylist.to/easylist/fanboy-annoyance.txt',
    ]);
    console.log('Ad-blocker engine initialized.');

    // Hook the blocker into the default session.
    blocker.enableBlockingInSession(session.defaultSession);

    console.log('Ad-blocker is now active.');
    blocker.on('request-blocked', (request) => {
      // This can be noisy, so it's commented out, but useful for debugging.
      // console.log('Blocked:', request.url);
    });
  } catch (err) {
    console.error('Failed to initialize ad-blocker engine:', err);
  }

  // --- Block Insecure HTTP Requests ---
  // This will cancel any top-level navigation to an http:// URL.
  session.defaultSession.webRequest.onBeforeRequest({
    urls: ['http://*/*']
  }, (details, callback) => {
    if (details.resourceType === 'mainFrame') {
      console.log(`Blocking insecure navigation to: ${details.url}`);
      callback({ cancel: true }); // Block the request
    } else {
      callback({ cancel: false }); // Allow other requests (e.g., images on an https page)
    }
  });

  createWindow(); // <-- This was missing, now it's fixed.

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
