const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('mp', {
  onSplash: function (cb) {
    ipcRenderer.on('splash', function (_e, text) { cb(text) })
  }
})
