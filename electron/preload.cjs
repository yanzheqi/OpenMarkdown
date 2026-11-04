const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('openMarkdownNative', {
  isNative: true,
  platform: process.platform,
  openMarkdownFile: () => ipcRenderer.invoke('openmarkdown:openMarkdown'),
  writeFile: (filePath, content) => ipcRenderer.invoke('openmarkdown:writeFile', { filePath, content }),
  saveFileAs: (options) => ipcRenderer.invoke('openmarkdown:saveFileAs', options),
  minimize: () => ipcRenderer.send('openmarkdown:window', 'minimize'),
  toggleMaximize: () => ipcRenderer.send('openmarkdown:window', 'toggleMaximize'),
  close: () => ipcRenderer.send('openmarkdown:window', 'close'),
})
