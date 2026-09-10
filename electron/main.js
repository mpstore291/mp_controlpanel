const { app, BrowserWindow, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const http = require('http')

function dataDir() {
  if (!app.isPackaged) return path.join(__dirname, '..', 'files')
  const dir = app.getPath('userData')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const names = ['bot.cfg', 'config.cfg']
  for (let i = 0; i < names.length; i++) {
    const dest = path.join(dir, names[i])
    if (fs.existsSync(dest)) continue
    const packed = path.join(process.resourcesPath, 'defaults', names[i])
    const local = path.join(__dirname, 'defaults', names[i])
    const src = fs.existsSync(packed) ? packed : local
    if (fs.existsSync(src)) fs.copyFileSync(src, dest)
  }
  return dir
}

function waitPanel() {
  return new Promise(function (ok, bad) {
    let n = 80
    const tick = function () {
      const req = http.get('http://127.0.0.1:3784/', function (res) {
        res.resume()
        ok()
      })
      req.on('error', function () {
        n -= 1
        if (n <= 0) bad(new Error('panel'))
        else setTimeout(tick, 200)
      })
    }
    tick()
  })
}

function openWin() {
  const win = new BrowserWindow({
    icon: path.join(__dirname, '..', 'files', 'icon.png'),
    title: 'MP BotControle',
    width: 1280,
    height: 820,
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#000000',
      symbolColor: '#ffffff',
      height: 36
    },
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  })
  win.loadURL('http://127.0.0.1:3784/')
  win.webContents.setWindowOpenHandler(function (d) {
    shell.openExternal(d.url)
    return { action: 'deny' }
  })
}

app.whenReady().then(function () {
  process.env.DAMZ_DATA = dataDir()
  if (app.isPackaged) process.env.DAMZ_PACKAGED = '1'
  require(path.join(__dirname, '..', 'files', 'index.js'))
  waitPanel().then(openWin).catch(function (e) {
    console.log(e)
    app.quit()
  })
})

app.on('window-all-closed', function () {
  app.quit()
})
