const fs = require('fs')
const path = require('path')
const { Jimp } = require('jimp')

const src = process.argv[2]
const outDir = process.argv[3]
const cropLeft = process.argv[4] ? Number(process.argv[4]) : 1

async function run() {
  const img = await Jimp.read(src)
  const w = img.bitmap.width
  const h = img.bitmap.height
  if (cropLeft < 1) img.crop({ x: 0, y: 0, w: Math.floor(w * cropLeft), h: h })
  const d = img.bitmap.data
  const ww = img.bitmap.width
  const hh = img.bitmap.height
  function paper(i) {
    const r = d[i]
    const g = d[i + 1]
    const b = d[i + 2]
    const a = d[i + 3]
    if (a < 8) return true
    const bright = (r + g + b) / 3
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    return bright > 165 && max - min < 55
  }
  const seen = Buffer.alloc(ww * hh)
  const q = []
  function add(x, y) {
    if (x < 0 || y < 0 || x >= ww || y >= hh) return
    const p = y * ww + x
    if (seen[p]) return
    if (!paper(p * 4)) return
    seen[p] = 1
    q.push(p)
  }
  for (let x = 0; x < ww; x++) {
    add(x, 0)
    add(x, hh - 1)
  }
  for (let y = 0; y < hh; y++) {
    add(0, y)
    add(ww - 1, y)
  }
  while (q.length) {
    const p = q.pop()
    const x = p % ww
    const y = (p - x) / ww
    d[p * 4 + 3] = 0
    add(x - 1, y)
    add(x + 1, y)
    add(x, y - 1)
    add(x, y + 1)
  }
  img.autocrop({ cropOnlyFrames: false, leaveBorder: 6 })
  const side = Math.max(img.bitmap.width, img.bitmap.height)
  const pad = Math.round(side * 0.08)
  const canvas = new Jimp({ width: side + pad * 2, height: side + pad * 2, color: 0x00000000 })
  canvas.composite(img, pad + Math.floor((side - img.bitmap.width) / 2), pad + Math.floor((side - img.bitmap.height) / 2))
  const big = canvas.resize({ w: 512, h: 512 })
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
  const png = path.join(outDir, 'icon.png')
  await big.write(png)
  const pngToIco = (await import('png-to-ico')).default
  const sizes = [256, 48, 32, 16]
  const files = []
  for (let i = 0; i < sizes.length; i++) {
    const s = sizes[i]
    const p = path.join(outDir, 'icon-' + s + '.png')
    await big.clone().resize({ w: s, h: s }).write(p)
    files.push(p)
  }
  fs.writeFileSync(path.join(outDir, 'icon.ico'), await pngToIco(files))
  console.log('ok', png)
}

run().catch(function (e) {
  console.error(e)
  process.exit(1)
})
