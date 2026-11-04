const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron')
const fs = require('node:fs/promises')
const path = require('node:path')

const isDev = Boolean(process.env.OPENMARKDOWN_DEV_URL)
let mainWindow = null

app.setAppUserModelId('com.openmarkdown.editor')

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 960,
    minHeight: 640,
    show: false,
    frame: false,
    backgroundColor: '#f2eee6',
    title: 'OpenMarkdown',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: true,
      backgroundThrottling: false,
    },
  })

  mainWindow = win
  Menu.setApplicationMenu(null)

  win.once('ready-to-show', () => {
    win.show()
    if (isDev) win.webContents.openDevTools({ mode: 'detach' })
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url === 'about:blank' || url.startsWith('blob:') || url.startsWith('data:')) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 980,
          height: 780,
          autoHideMenuBar: true,
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
          },
        },
      }
    }
    if (/^https?:\/\//i.test(url)) {
      void shell.openExternal(url)
      return { action: 'deny' }
    }
    return { action: 'deny' }
  })

  win.webContents.on('will-navigate', (event, url) => {
    const current = win.webContents.getURL()
    if (url === current) return
    event.preventDefault()
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url)
  })

  if (isDev) {
    void win.loadURL(process.env.OPENMARKDOWN_DEV_URL)
  } else {
    void win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  win.webContents.on('did-fail-load', (_event, code, description, url) => {
    console.error('OpenMarkdown failed to load', code, description, url)
  })

  if (process.env.OPENMARKDOWN_SCREENSHOT) {
    win.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        try {
          const image = await win.webContents.capturePage()
          await fs.writeFile(process.env.OPENMARKDOWN_SCREENSHOT, image.toPNG())
          console.log('SCREENSHOT_SAVED', process.env.OPENMARKDOWN_SCREENSHOT)
        } catch (error) {
          console.error('Screenshot failed', error)
        } finally {
          app.quit()
        }
      }, 3200)
    })
  }
}

ipcMain.handle('openmarkdown:openMarkdown', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '打开 Markdown 文件',
    properties: ['openFile'],
    filters: [
      { name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd', 'txt'] },
      { name: '所有文件', extensions: ['*'] },
    ],
  })
  if (result.canceled || !result.filePaths[0]) return { canceled: true }
  const filePath = result.filePaths[0]
  try {
    const content = await fs.readFile(filePath, 'utf8')
    return {
      canceled: false,
      filePath,
      fileName: path.basename(filePath),
      content,
    }
  } catch (error) {
    return { canceled: false, error: error instanceof Error ? error.message : String(error) }
  }
})

ipcMain.handle('openmarkdown:writeFile', async (_event, payload) => {
  try {
    const filePath = String(payload?.filePath ?? '')
    const content = String(payload?.content ?? '')
    if (!filePath) return { ok: false, error: 'Missing file path' }
    await fs.writeFile(filePath, content, 'utf8')
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
})

ipcMain.handle('openmarkdown:saveFileAs', async (_event, payload) => {
  const defaultName = String(payload?.defaultName ?? 'document.txt')
  const content = String(payload?.content ?? '')
  const filters = Array.isArray(payload?.filters) ? payload.filters : undefined
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '保存文件',
    defaultPath: path.join(app.getPath('documents'), defaultName),
    filters,
  })
  if (result.canceled || !result.filePath) return { canceled: true }
  try {
    await fs.writeFile(result.filePath, content, 'utf8')
    return {
      canceled: false,
      filePath: result.filePath,
      fileName: path.basename(result.filePath),
    }
  } catch (error) {
    return { canceled: false, error: error instanceof Error ? error.message : String(error) }
  }
})

ipcMain.on('openmarkdown:window', (_event, action) => {
  if (!mainWindow) return
  if (action === 'minimize') mainWindow.minimize()
  else if (action === 'toggleMaximize') {
    if (mainWindow.isMaximized()) mainWindow.unmaximize()
    else mainWindow.maximize()
  } else if (action === 'close') mainWindow.close()
})

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })

  app.whenReady().then(() => {
    createWindow()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
