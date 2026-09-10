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

const args = [
  'electron-builder',
  '--win',
  'nsis',
  '--publish',
  'never',
  '-c.publish.provider=github',
  '-c.publish.owner=' + owner,
  '-c.publish.repo=' + repo
]
const r = spawnSync('npx', args, { stdio: 'inherit', shell: true, cwd: path.join(__dirname, '..') })
process.exit(r.status == null ? 1 : r.status)
