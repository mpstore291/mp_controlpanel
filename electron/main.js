const { app, BrowserWindow, shell } = require('electron')
const { autoUpdater } = require('electron-updater')
const path = require('path')
const fs = require('fs')
const http = require('http')

let win = null
let opened = false
let hang = null

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

function githubBits() {
  const files = [
    path.join(__dirname, 'github.cfg'),
    path.join(process.resourcesPath || '', 'github.cfg')
  ]
  let owner = 'mpstore291'
  let repo = 'mp_controlpanel'
  for (let i = 0; i < files.length; i++) {
    if (!fs.existsSync(files[i])) continue
    const lines = fs.readFileSync(files[i], 'utf8').split(/\r?\n/)
    for (let n = 0; n < lines.length; n++) {
      const line = lines[n].trim()
      const eq = line.indexOf('=')
      if (eq < 1) continue
      const k = line.slice(0, eq).trim()
      const v = line.slice(eq + 1).trim()
      if (k === 'owner' && v) owner = v
      if (k === 'repo' && v) repo = v
    }
  }
  return { owner: owner, repo: repo }
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

function splash(text) {
  if (win && !win.isDestroyed()) win.webContents.send('splash', text)
}

function goApp() {
  if (opened) return
  opened = true
  if (hang) {
    clearTimeout(hang)
    hang = null
  }
  splash('Åbner...')
  waitPanel().then(function () {
    if (win && !win.isDestroyed()) win.loadURL('http://127.0.0.1:3784/')
  }).catch(function (e) {
    console.log(e)
    app.quit()
  })
}

function openWin() {
  win = new BrowserWindow({
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
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  })
  win.loadFile(path.join(__dirname, 'splash.html'))
  win.webContents.setWindowOpenHandler(function (d) {
    shell.openExternal(d.url)
    return { action: 'deny' }
  })
  win.on('closed', function () { win = null })
}

function setupUpdater() {
  if (!app.isPackaged) {
    splash('Klar')
    setTimeout(goApp, 800)
    return
  }
  const g = githubBits()
  try {
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: g.owner,
      repo: g.repo
    })
  } catch (e) {
    console.log(e)
  }
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  hang = setTimeout(function () {
    hang = null
    goApp()
  }, 20000)
  autoUpdater.on('checking-for-update', function () {
    splash('Søger efter opdateringer...')
  })
  autoUpdater.on('update-not-available', function () {
    splash('Du kører den nyeste version')
    setTimeout(goApp, 700)
  })
  autoUpdater.on('update-available', function (info) {
    if (hang) {
      clearTimeout(hang)
      hang = null
    }
    splash('Henter version ' + (info && info.version ? info.version : '') + '...')
  })
  autoUpdater.on('download-progress', function (p) {
    const n = p && p.percent ? Math.round(p.percent) : 0
    splash('Henter opdatering... ' + n + '%')
  })
  autoUpdater.on('update-downloaded', function () {
    splash('Installerer opdatering...')
    setTimeout(function () {
      autoUpdater.quitAndInstall(false, true)
    }, 400)
  })
  autoUpdater.on('error', function (e) {
    console.log('update', e)
    splash('Klar')
    setTimeout(goApp, 700)
  })
  autoUpdater.checkForUpdates().catch(function (e) {
    console.log('update', e)
    splash('Klar')
    setTimeout(goApp, 700)
  })
}

app.whenReady().then(function () {
  process.env.DAMZ_DATA = dataDir()
  if (app.isPackaged) process.env.DAMZ_PACKAGED = '1'
  require(path.join(__dirname, '..', 'files', 'index.js'))
  openWin()
  setupUpdater()
})

app.on('window-all-closed', function () {
  app.quit()
})
