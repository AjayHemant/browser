// main.js

// Modules to control application life and create native browser window
const { app, BrowserWindow, ipcMain } = require('electron');
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
app.whenReady().then(() => {
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
