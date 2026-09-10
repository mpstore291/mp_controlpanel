const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

function val(file, key) {
  if (!fs.existsSync(file)) return ''
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (line.indexOf(key + '=') === 0) return line.slice(key.length + 1).trim()
  }
  return ''
}

function githubToken() {
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN
  const files = [
    path.join(process.env.APPDATA || '', 'MP BotControle', 'bot.cfg'),
    path.join(__dirname, '..', 'files', 'bot.cfg')
  ]
  for (let i = 0; i < files.length; i++) {
    const t = val(files[i], 'github_token')
    if (t) return t
  }
  return ''
}

const cfg = path.join(__dirname, 'github.cfg')
const owner = val(cfg, 'owner')
const repo = val(cfg, 'repo')
if (!owner || !repo) {
  console.log('Auto-update kraever et public GitHub repo.')
  console.log('Udfyld electron/github.cfg:')
  console.log('  owner=dit-github-navn')
  console.log('  repo=dit-repo-navn')
  process.exit(1)
}

const tok = githubToken()
const pub = tok ? 'always' : 'never'
if (tok) console.log('Uploader installer til GitHub Release...')
else console.log('Ingen GitHub token. Bygger kun lokalt.')

const args = [
  'electron-builder',
  '--win',
  'nsis',
  '--publish',
  pub,
  '-c.publish.provider=github',
  '-c.publish.owner=' + owner,
  '-c.publish.repo=' + repo,
  '-c.publish.releaseType=release'
]
const env = Object.assign({}, process.env)
if (tok) env.GH_TOKEN = tok
const r = spawnSync('npx', args, {
  stdio: 'inherit',
  shell: true,
  cwd: path.join(__dirname, '..'),
  env: env
})
process.exit(r.status == null ? 1 : r.status)
