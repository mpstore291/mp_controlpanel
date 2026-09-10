const fs = require('fs')
const path = require('path')
const http = require('http')
const os = require('os')
const crypto = require('crypto')
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
  PermissionFlagsBits
} = require('discord.js')

const codeRoot = __dirname
const dataRoot = process.env.DAMZ_DATA || __dirname
const ticketFile = path.join(dataRoot, 'tickets.json')
const sessions = {}
const logs = []

function logLine(level, args) {
  const parts = []
  for (let i = 0; i < args.length; i++) {
    const v = args[i]
    if (v instanceof Error) parts.push(v.stack || String(v.message || v))
    else if (typeof v === 'object' && v) {
      try { parts.push(JSON.stringify(v)) } catch (e) { parts.push(String(v)) }
    } else parts.push(String(v))
  }
  logs.push({ t: Date.now(), level: level, msg: parts.join(' ') })
  if (logs.length > 500) logs.splice(0, logs.length - 500)
}

const _log = console.log
const _warn = console.warn
const _err = console.error
console.log = function () { logLine('log', arguments); _log.apply(console, arguments) }
console.warn = function () { logLine('warn', arguments); _warn.apply(console, arguments) }
console.error = function () { logLine('error', arguments); _err.apply(console, arguments) }

const skip = {
  open_in: 1,
  ticket_kategori: 1,
  abnes_i: 1,
  log_channel: 1,
  log_kanal: 1,
  staff_roles: 1,
  staff_roller: 1,
  color: 1,
  farve: 1,
  footer: 1,
  max_tickets: 1,
  panel_command: 1,
  panel_title: 1,
  panel_titel: 1,
  panel_text: 1,
  panel_tekst: 1,
  dropdown: 1,
  close_button: 1,
  luk_knap: 1,
  close_emoji: 1,
  luk_emoji: 1,
  claim_button: 1,
  claim_knap: 1,
  claim_emoji: 1,
  close_title: 1,
  luk_titel: 1,
  close_reason: 1,
  luk_grund: 1,
  ticket_title: 1,
  ticket_titel: 1,
  token: 1,
  client_id: 1,
  server_id: 1,
  guild_id: 1,
  github_token: 1,
  port: 1
}

function parseCfg(file) {
  if (!fs.existsSync(file)) return {}
  const text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')
  const data = {}
  let cur = data
  const lines = text.split(/\r?\n/)
  for (let n = 0; n < lines.length; n++) {
    const line = lines[n].trim()
    if (!line) continue
    if (line[0] === '[' && line[line.length - 1] === ']') {
      const name = line.slice(1, -1).trim()
      if (!data[name] || typeof data[name] !== 'object' || Array.isArray(data[name])) data[name] = {}
      cur = data[name]
      continue
    }
    const eq = line.indexOf('=')
    if (eq < 1) continue
    const k = line.slice(0, eq).trim()
    let v = line.slice(eq + 1)
    if (v.startsWith(' ')) v = v.slice(1)
    if ((v[0] === '"' && v[v.length - 1] === '"') || (v[0] === "'" && v[v.length - 1] === "'")) v = v.slice(1, -1)
    v = v.replace(/\\n/g, '\n').replace(/\\t/g, '\t')
    if (Object.prototype.hasOwnProperty.call(cur, k)) {
      if (!Array.isArray(cur[k])) cur[k] = [cur[k]]
      cur[k].push(v)
    } else {
      cur[k] = v
    }
  }
  return data
}

function loadBot() {
  return parseCfg(path.join(dataRoot, 'bot.cfg'))
}

function loadCfg() {
  return parseCfg(path.join(dataRoot, 'config.cfg'))
}

function one(v) {
  if (v == null) return ''
  if (Array.isArray(v)) return v.length ? String(v[0]) : ''
  return String(v)
}

function joinVal(v, sep) {
  if (v == null || v === '') return ''
  if (Array.isArray(v)) return v.join(sep == null ? '\n' : sep)
  return String(v)
}

function putLines(lines, k, v) {
  lines.push(k + '=' + String(v == null ? '' : v).replace(/\r?\n/g, '\\n'))
}

function dumpBot(b) {
  const lines = []
  putLines(lines, 'token', b.token)
  putLines(lines, 'client_id', b.client_id)
  putLines(lines, 'server_id', b.server_id)
  putLines(lines, 'port', b.port || '3784')
  putLines(lines, 'github_token', b.github_token)
  return lines.join('\n') + '\n'
}

function dumpCfg(s) {
  const lines = []
  putLines(lines, 'log_channel', s.log_channel)
  putLines(lines, 'staff_roles', s.staff_roles)
  putLines(lines, 'color', s.color)
  putLines(lines, 'footer', s.footer)
  putLines(lines, 'max_tickets', s.max_tickets)
  lines.push('')
  putLines(lines, 'dropdown', s.dropdown)
  lines.push('')
  putLines(lines, 'close_button', s.close_button)
  putLines(lines, 'close_emoji', s.close_emoji)
  putLines(lines, 'claim_button', s.claim_button)
  putLines(lines, 'claim_emoji', s.claim_emoji)
  lines.push('')
  putLines(lines, 'close_title', s.close_title)
  putLines(lines, 'close_reason', s.close_reason)
  putLines(lines, 'ticket_title', s.ticket_title)
  lines.push('')
  const panels = s.panels || []
  for (let p = 0; p < panels.length; p++) {
    const pan = panels[p]
    const pname = String(pan.name || '').replace(/[\[\]]/g, '').trim() || ('Panel ' + (p + 1))
    lines.push('[panel:' + pname + ']')
    putLines(lines, 'command', pan.command)
    putLines(lines, 'description', pan.description)
    putLines(lines, 'title', pan.title)
    putLines(lines, 'text', pan.text)
    lines.push('')
  }
  const cats = s.categories || []
  for (let i = 0; i < cats.length; i++) {
    const cat = cats[i]
    const name = String(cat.name || '').trim()
    if (!name) continue
    if (String(name).indexOf('panel:') === 0) continue
    lines.push('[' + name + ']')
    putLines(lines, 'emoji', cat.emoji)
    putLines(lines, 'text', cat.text)
    putLines(lines, 'tag', cat.tag)
    putLines(lines, 'open_in', cat.open_in)
    const msgs = String(cat.message || '').split(/\r?\n/)
    let got = false
    for (let m = 0; m < msgs.length; m++) {
      if (msgs[m] === '' && m === msgs.length - 1 && got) continue
      lines.push('message=' + msgs[m])
      got = true
    }
    if (!got) lines.push('message=')
    const qs = String(cat.question || '').split(/\r?\n/)
    for (let q = 0; q < qs.length; q++) {
      if (!String(qs[q]).trim()) continue
      lines.push('question=' + qs[q])
    }
    lines.push('')
  }
  return lines.join('\n')
}

function isPanelKey(k) {
  return String(k).indexOf('panel:') === 0
}

function cmdName(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32)
}

function readPanels(cfg) {
  const out = []
  const keys = Object.keys(cfg)
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i]
    if (!isPanelKey(k)) continue
    const v = cfg[k]
    if (!v || typeof v !== 'object' || Array.isArray(v)) continue
    out.push({
      name: k.slice(6).trim() || 'Panel',
      command: one(v.command),
      description: one(v.description || v.beskrivelse),
      title: one(v.title || v.titel),
      text: joinVal(v.text || v.tekst)
    })
  }
  if (!out.length) {
    const title = one(cfg.panel_title || cfg.panel_titel)
    const text = joinVal(cfg.panel_text || cfg.panel_tekst)
    const command = one(cfg.panel_command)
    if (title || text || (command && command !== 'panel')) {
      out.push({
        name: 'Panel',
        command: command || 'panel',
        description: '',
        title: title,
        text: text
      })
    }
  }
  return out
}

function cfgState() {
  const cfg = loadCfg()
  const cats = []
  const keys = Object.keys(cfg)
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i]
    if (skip[k] || isPanelKey(k)) continue
    const v = cfg[k]
    if (!v || typeof v !== 'object' || Array.isArray(v)) continue
    const text = joinVal(v.text || v.tekst)
    const message = joinVal(v.message || v.besked)
    const question = joinVal(v.question || v.sporgsmal)
    const emoji = one(v.emoji)
    const tag = joinVal(v.tag || v.ping, ', ')
    const openIn = one(v.open_in || v.abnes_i || v.kategori)
    cats.push({
      name: k,
      emoji: emoji,
      text: text,
      tag: tag,
      open_in: openIn,
      message: message,
      question: question
    })
  }
  return {
    log_channel: one(cfg.log_channel || cfg.log_kanal),
    staff_roles: one(cfg.staff_roles || cfg.staff_roller),
    color: one(cfg.color || cfg.farve) || '#5865F2',
    footer: one(cfg.footer),
    max_tickets: one(cfg.max_tickets) || '1',
    panel_command: one(cfg.panel_command) || 'panel',
    panel_title: one(cfg.panel_title || cfg.panel_titel),
    panel_text: joinVal(cfg.panel_text || cfg.panel_tekst),
    dropdown: one(cfg.dropdown),
    close_button: one(cfg.close_button || cfg.luk_knap) || 'Close',
    close_emoji: one(cfg.close_emoji || cfg.luk_emoji),
    claim_button: one(cfg.claim_button || cfg.claim_knap) || 'Claim',
    claim_emoji: one(cfg.claim_emoji),
    close_title: one(cfg.close_title || cfg.luk_titel),
    close_reason: one(cfg.close_reason || cfg.luk_grund) || 'Close Reason',
    ticket_title: one(cfg.ticket_title || cfg.ticket_titel) || 'Ticket Created',
    panels: readPanels(cfg),
    categories: cats
  }
}

function list(v) {
  if (v == null || v === '') return []
  return Array.isArray(v) ? v.map(String) : [String(v)]
}

function joinText(v) {
  if (v == null || v === '') return ''
  return Array.isArray(v) ? v.join('\n') : String(v)
}

function csv(v) {
  if (v == null || v === '') return []
  const parts = Array.isArray(v) ? v : [v]
  const out = []
  for (let i = 0; i < parts.length; i++) {
    const bits = String(parts[i]).split(/[,; ]+/)
    for (let j = 0; j < bits.length; j++) {
      const m = String(bits[j]).match(/\d{15,}/)
      if (m) out.push(m[0])
    }
  }
  return out
}

function grab(obj) {
  if (!obj) return ''
  for (let i = 1; i < arguments.length; i++) {
    const v = obj[arguments[i]]
    if (v == null || v === '') continue
    if (Array.isArray(v)) {
      const keep = []
      for (let n = 0; n < v.length; n++) {
        if (String(v[n]).trim()) keep.push(v[n])
      }
      if (keep.length) return keep
    } else if (String(v).trim()) return v
  }
  return ''
}

function color(v) {
  if (!v) return 0x2b2d31
  const n = parseInt(String(v).replace('#', ''), 16)
  return Number.isNaN(n) ? 0x2b2d31 : n
}

function slug(s) {
  const v = String(s)
    .toLowerCase()
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'o')
    .replace(/å/g, 'aa')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100)
  return v || 'kat'
}

function tom(v) {
  if (v == null) return true
  if (Array.isArray(v)) {
    for (let i = 0; i < v.length; i++) {
      if (String(v[i]).trim()) return false
    }
    return true
  }
  return !String(v).trim()
}

function cats(c) {
  const out = []
  const keys = Object.keys(c)
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i]
    if (skip[k] || isPanelKey(k)) continue
    const v = c[k]
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      if (tom(v.emoji) && tom(v.text) && tom(v.tekst) && tom(v.message) && tom(v.besked) && tom(v.question) && tom(v.sporgsmal)) continue
      out.push([slug(k), Object.assign({ navn: k }, v)])
    }
  }
  return out
}

function sted(cat) {
  const ids = csv(grab(cat, 'open_in', 'abnes_i', 'kategori'))
  return ids.length ? ids[0] : undefined
}

function panelCmd(c) {
  let n = String(grab(c, 'panel_command') || 'panel').toLowerCase().replace(/[^a-z0-9_-]/g, '')
  if (!n || n.length > 32) n = 'panel'
  return n
}

function findCat(c, key) {
  const items = cats(c)
  for (let i = 0; i < items.length; i++) {
    if (items[i][0] === key) return items[i][1]
  }
  return null
}

function nick(user) {
  const s = String(user.username || 'user').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 18)
  return s || 'user'
}

function loadTickets() {
  try {
    return JSON.parse(fs.readFileSync(ticketFile, 'utf8'))
  } catch (e) {
    return {}
  }
}

function saveTickets() {
  fs.writeFileSync(ticketFile, JSON.stringify(tickets, null, 2))
}

let tickets = loadTickets()
let client = null

function staffMember(mem, c, cat) {
  if (!mem) return false
  if (mem.permissions.has(PermissionFlagsBits.Administrator) || mem.permissions.has(PermissionFlagsBits.ManageGuild)) return true
  const ids = csv(grab(c, 'staff_roles', 'staff_roller')).concat(csv(cat && grab(cat, 'staff')), csv(cat && grab(cat, 'tag', 'ping')))
  for (let i = 0; i < ids.length; i++) {
    if (mem.id === ids[i] || mem.roles.cache.has(ids[i])) return true
  }
  return false
}

function mentionTags(guild, ids) {
  const out = []
  for (let i = 0; i < ids.length; i++) {
    if (guild.roles.cache.has(ids[i])) out.push('<@&' + ids[i] + '>')
    else out.push('<@' + ids[i] + '>')
  }
  return out
}

function panelRow(c) {
  const items = cats(c).slice(0, 25)
  if (!items.length) return null
  const menu = new StringSelectMenuBuilder()
    .setCustomId('panel_select')
    .setPlaceholder(String(grab(c, 'dropdown') || 'Select'))
  for (let i = 0; i < items.length; i++) {
    const key = items[i][0]
    const cat = items[i][1]
    const opt = new StringSelectMenuOptionBuilder()
      .setLabel(String(cat.navn).slice(0, 100))
      .setValue(key)
    const desc = grab(cat, 'text', 'tekst', 'description')
    if (desc) opt.setDescription(String(Array.isArray(desc) ? desc[0] : desc).slice(0, 100))
    if (cat.emoji) {
      try {
        opt.setEmoji(Array.isArray(cat.emoji) ? cat.emoji[0] : cat.emoji)
      } catch (e) {}
    }
    menu.addOptions(opt)
  }
  return new ActionRowBuilder().addComponents(menu)
}

function ticketBtns(c) {
  const close = new ButtonBuilder()
    .setCustomId('close_btn')
    .setLabel(String(grab(c, 'close_button', 'luk_knap') || 'Close'))
    .setStyle(ButtonStyle.Secondary)
  const ce = grab(c, 'close_emoji', 'luk_emoji')
  if (ce) close.setEmoji(Array.isArray(ce) ? ce[0] : ce)
  const claim = new ButtonBuilder()
    .setCustomId('claim_btn')
    .setLabel(String(grab(c, 'claim_button', 'claim_knap') || 'Claim'))
    .setStyle(ButtonStyle.Secondary)
  const cle = grab(c, 'claim_emoji')
  if (cle) claim.setEmoji(Array.isArray(cle) ? cle[0] : cle)
  return new ActionRowBuilder().addComponents(close, claim)
}

async function sendLog(guild, c, kind, map) {
  const ids = csv(grab(c, 'log_channel', 'log_kanal'))
  if (!ids.length) return
  const title = kind === 'open' ? 'Ticket opened' : 'Ticket closed'
  let desc = ''
  if (kind === 'open') desc = 'User: ' + map.user + '\nCategory: ' + map.type + '\nChannel: ' + map.channel
  else desc = 'User: ' + map.user + '\nClosed by: ' + map.staff + '\nCategory: ' + map.type + '\nChannel: ' + map.channel + '\nReason: ' + map.reason
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(desc)
    .setColor(color(kind === 'open' ? '#57F287' : '#ED4245'))
    .setTimestamp(new Date())
  if (c.footer) embed.setFooter({ text: c.footer })
  for (let n = 0; n < ids.length; n++) {
    const ch = await guild.channels.fetch(ids[n]).catch(function () { return null })
    if (ch) await ch.send({ embeds: [embed] }).catch(function () {})
  }
}

async function sendPanel(i, panel) {
  const c = loadCfg()
  const mem = i.member
  if (!mem || !mem.permissions.has(PermissionFlagsBits.ManageGuild)) {
    await i.reply({ content: 'Det kan du ikke.', ephemeral: true })
    return
  }
  const row = panelRow(c)
  if (!row) {
    await i.reply({ content: 'Ingen kategorier i config.cfg', ephemeral: true })
    return
  }
  const embed = new EmbedBuilder().setColor(color(grab(c, 'color', 'farve')))
  const title = panel && panel.title ? panel.title : ''
  const text = panel && panel.text ? panel.text : ''
  if (title) embed.setTitle(String(Array.isArray(title) ? title[0] : title))
  if (text) embed.setDescription(joinText(text))
  if (c.footer) embed.setFooter({ text: c.footer })
  const payload = { components: [row] }
  if (title || text || c.footer) payload.embeds = [embed]
  await i.reply(payload)
}

async function openTicket(i, key) {
  const c = loadCfg()
  const cat = findCat(c, key)
  if (!cat) {
    await i.reply({ content: 'Kategorien findes ikke.', ephemeral: true })
    return
  }
  const mine = []
  const ids = Object.keys(tickets)
  for (let n = 0; n < ids.length; n++) {
    const t = tickets[ids[n]]
    if (t.user === i.user.id && i.guild.channels.cache.has(ids[n])) mine.push(ids[n])
  }
  const max = Number(c.max_tickets || 1)
  if (mine.length >= max) {
    await i.reply({ content: 'Du har allerede en åben ticket: <#' + mine[0] + '>', ephemeral: true })
    return
  }
  await i.deferReply({ ephemeral: true })
  await i.guild.roles.fetch().catch(function () {})
  const access = csv(grab(cat, 'staff')).length ? csv(grab(cat, 'staff')) : csv(grab(cat, 'tag', 'ping'))
  const extra = csv(grab(c, 'staff_roles', 'staff_roller'))
  const overwrites = [
    { id: i.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: i.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks] },
    { id: i.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.EmbedLinks] }
  ]
  const seen = {}
  const people = access.concat(extra)
  for (let n = 0; n < people.length; n++) {
    if (seen[people[n]]) continue
    seen[people[n]] = true
    overwrites.push({
      id: people[n],
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks]
    })
  }
  let name = 'ticket-' + nick(i.user)
  name = name.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 90) || 'ticket'
  const parent = sted(cat)
  let ch
  try {
    ch = await i.guild.channels.create({
      name: name,
      type: ChannelType.GuildText,
      parent: parent || undefined,
      permissionOverwrites: overwrites
    })
  } catch (e) {
    console.log(e)
    await i.editReply({ content: 'Ticket kunne ikke oprettes. Vælg hvor den åbner i kategorien.' })
    return
  }
  tickets[ch.id] = { user: i.user.id, type: key, claimed: null, opened: Date.now() }
  saveTickets()
  const pings = csv(grab(cat, 'tag', 'ping'))
  let mention = i.user.toString()
  const tags = mentionTags(i.guild, pings)
  for (let n = 0; n < tags.length; n++) mention += ' ' + tags[n]
  const qs = list(grab(cat, 'question', 'sporgsmal'))
  let desc = joinText(grab(cat, 'message', 'besked', 'open_text'))
  if (qs.length) desc += (desc ? '\n\n' : '') + qs.join('\n\n')
  const embed = new EmbedBuilder()
    .setTitle(String(grab(cat, 'title', 'titel') || grab(c, 'ticket_title', 'ticket_titel') || 'Ticket Created'))
    .setDescription(desc || '-')
    .setColor(color(grab(c, 'color', 'farve')))
  if (c.footer) embed.setFooter({ text: c.footer })
  await ch.send({ content: mention, embeds: [embed], components: [ticketBtns(c)] })
  await sendLog(i.guild, c, 'open', {
    user: i.user.toString(),
    type: cat.navn || key,
    channel: ch.toString()
  })
  await i.editReply({ content: 'Din ticket er oprettet: ' + ch.toString() })
  if (i.message && i.message.editable) {
    const row = panelRow(c)
    if (row) await i.message.edit({ components: [row] }).catch(function () {})
  }
}

async function showClose(i) {
  const c = loadCfg()
  const t = tickets[i.channel.id]
  const cat = t ? findCat(c, t.type) : null
  const mem = i.member
  const owner = t && t.user === i.user.id
  if (!t) {
    await i.reply({ content: 'Det her er ikke en ticket.', ephemeral: true })
    return
  }
  if (!owner && !staffMember(mem, c, cat)) {
    await i.reply({ content: 'Det kan du ikke.', ephemeral: true })
    return
  }
  const modal = new ModalBuilder()
    .setCustomId('close_modal')
    .setTitle(String(grab(c, 'close_title', 'luk_titel') || 'Close ticket').slice(0, 45))
  const input = new TextInputBuilder()
    .setCustomId('close_reason')
    .setLabel(String(grab(c, 'close_reason', 'luk_grund') || 'Close Reason').slice(0, 45))
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(1000)
  modal.addComponents(new ActionRowBuilder().addComponents(input))
  await i.showModal(modal)
}

async function closeTicket(i) {
  const c = loadCfg()
  const reason = i.fields.getTextInputValue('close_reason') || '-'
  const t = tickets[i.channel.id]
  const cat = t ? findCat(c, t.type) : null
  const mem = i.member
  const owner = t && t.user === i.user.id
  if (!t) {
    await i.reply({ content: 'Det her er ikke en ticket.', ephemeral: true })
    return
  }
  if (!owner && !staffMember(mem, c, cat)) {
    await i.reply({ content: 'Det kan du ikke.', ephemeral: true })
    return
  }
  const opener = t ? await i.client.users.fetch(t.user).catch(function () { return null }) : null
  await sendLog(i.guild, c, 'close', {
    user: opener ? opener.toString() : (t ? '<@' + t.user + '>' : 'ukendt'),
    staff: i.user.toString(),
    type: cat && cat.navn ? cat.navn : (t ? t.type : i.channel.name),
    channel: i.channel.toString(),
    reason: reason
  })
  delete tickets[i.channel.id]
  saveTickets()
  await i.reply({ content: 'Ticket lukkes...' })
  setTimeout(function () {
    i.channel.delete().catch(function () {})
  }, 2500)
}

async function claimTicket(i) {
  const c = loadCfg()
  const t = tickets[i.channel.id]
  const cat = t ? findCat(c, t.type) : null
  const mem = i.member
  if (!t) {
    await i.reply({ content: 'Det her er ikke en ticket.', ephemeral: true })
    return
  }
  if (!staffMember(mem, c, cat)) {
    await i.reply({ content: 'Det kan du ikke.', ephemeral: true })
    return
  }
  if (t.claimed) {
    await i.reply({ content: 'Ticket er allerede claimed af <@' + t.claimed + '>', ephemeral: true })
    return
  }
  t.claimed = i.user.id
  saveTickets()
  await i.reply({ content: 'Ticket claimed af ' + i.user.toString() })
}

async function registerCommands() {
  const bot = loadBot()
  if (!bot.token || !bot.client_id || !bot.server_id) return
  const rest = new REST({ version: '10' }).setToken(bot.token)
  const list = readPanels(loadCfg())
  const body = []
  const seen = {}
  for (let i = 0; i < list.length; i++) {
    const name = cmdName(list[i].command)
    if (!name || seen[name]) continue
    seen[name] = 1
    let desc = String(list[i].description || '').trim().slice(0, 100)
    if (!desc) desc = 'Send panel'
    body.push(
      new SlashCommandBuilder()
        .setName(name)
        .setDescription(desc)
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .toJSON()
    )
  }
  await rest.put(Routes.applicationGuildCommands(bot.client_id, bot.server_id), { body: body })
}

function attach(c) {
  c.on('ready', async function () {
    const bot = loadBot()
    if (bot.server_id) {
      const g = await c.guilds.fetch(bot.server_id).catch(function () { return null })
      if (g) {
        await g.channels.fetch().catch(function () {})
        await g.roles.fetch().catch(function () {})
        const ids = Object.keys(tickets)
        for (let n = 0; n < ids.length; n++) {
          if (!g.channels.cache.has(ids[n])) delete tickets[ids[n]]
        }
        saveTickets()
        await registerCommands().catch(function (e) { console.log(e) })
      }
    }
    console.log('online', c.user.tag)
  })
  c.on('interactionCreate', async function (i) {
    try {
      const cfg = loadCfg()
      if (i.isChatInputCommand()) {
        const list = readPanels(cfg)
        for (let n = 0; n < list.length; n++) {
          if (cmdName(list[n].command) === i.commandName) {
            await sendPanel(i, list[n])
            return
          }
        }
      }
      if (i.isStringSelectMenu() && i.customId === 'panel_select') {
        await openTicket(i, i.values[0])
        return
      }
      if (i.isButton() && i.customId === 'close_btn') {
        await showClose(i)
        return
      }
      if (i.isButton() && i.customId === 'claim_btn') {
        await claimTicket(i)
        return
      }
      if (i.isModalSubmit() && i.customId === 'close_modal') {
        await closeTicket(i)
        return
      }
    } catch (err) {
      console.log(err)
      if (i.isRepliable() && !i.replied && !i.deferred) {
        i.reply({ content: 'Der skete en fejl.', ephemeral: true }).catch(function () {})
      }
    }
  })
  c.on('channelDelete', function (ch) {
    if (tickets[ch.id]) {
      delete tickets[ch.id]
      saveTickets()
    }
  })
}

let boot = Promise.resolve()

function sleep(ms) {
  return new Promise(function (ok) { setTimeout(ok, ms) })
}

async function startBot() {
  const run = (async function () {
    const bot = loadBot()
    if (!one(bot.token)) throw new Error('token')
    if (client) {
      client.removeAllListeners()
      await client.destroy().catch(function () {})
      client = null
    }
    client = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
    })
    attach(client)
    await client.login(bot.token)
    await client.guilds.fetch().catch(function () {})
    const appId = client.application && client.application.id ? client.application.id : ''
    if (appId && !one(bot.client_id)) {
      fs.writeFileSync(path.join(dataRoot, 'bot.cfg'), dumpBot({
        token: bot.token,
        client_id: appId,
        server_id: bot.server_id || '',
        port: bot.port || '3784',
        github_token: bot.github_token
      }))
    }
  })()
  boot = run
  return run
}

async function waitReady(ms) {
  try { await boot } catch (e) {}
  const end = Date.now() + (ms || 15000)
  while (Date.now() < end) {
    if (client && client.isReady()) return true
    await sleep(150)
  }
  return !!(client && client.isReady())
}

function guildList() {
  if (!client || !client.isReady()) return []
  return client.guilds.cache.map(function (g) {
    return { id: g.id, name: g.name }
  }).sort(function (a, b) { return a.name.localeCompare(b.name) })
}

async function discordBits() {
  const bot = loadBot()
  const empty = { roles: [], categories: [], channels: [], guild: null }
  if (!client || !client.isReady() || !bot.server_id) return empty
  const g = client.guilds.cache.get(bot.server_id) || await client.guilds.fetch(bot.server_id).catch(function () { return null })
  if (!g) return empty
  await g.roles.fetch().catch(function () {})
  await g.channels.fetch().catch(function () {})
  const roles = g.roles.cache
    .filter(function (r) { return r.id !== g.id })
    .sort(function (a, b) { return b.position - a.position })
    .map(function (r) { return { id: r.id, name: r.name } })
  const categories = g.channels.cache
    .filter(function (ch) { return ch.type === ChannelType.GuildCategory })
    .sort(function (a, b) { return a.rawPosition - b.rawPosition })
    .map(function (ch) { return { id: ch.id, name: ch.name } })
  const channels = g.channels.cache
    .filter(function (ch) { return ch.type === ChannelType.GuildText })
    .sort(function (a, b) { return a.rawPosition - b.rawPosition })
    .map(function (ch) { return { id: ch.id, name: ch.name } })
  return { roles: roles, categories: categories, channels: channels, guild: { id: g.id, name: g.name } }
}

function cookieSid(req) {
  const raw = String(req.headers.cookie || '')
  const parts = raw.split(';')
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i].trim()
    if (p.indexOf('sid=') === 0) return p.slice(4)
  }
  return ''
}

function authed(req) {
  const s = cookieSid(req)
  return !!(s && sessions[s])
}

const ADMIN_USER = 'måadmin'
const ADMIN_PASS = 'mpadmin'
const AUTH_FILE = 'auth/users.json'
const AUTH_KEY = crypto.scryptSync(ADMIN_PASS, 'mp-botcontrole-auth-v1', 32)

function parseIni(file) {
  const out = {}
  if (!fs.existsSync(file)) return out
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    const eq = line.indexOf('=')
    if (eq < 1) continue
    out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim()
  }
  return out
}

function githubBits() {
  const paths = [
    path.join(codeRoot, '..', 'electron', 'github.cfg'),
    path.join(process.resourcesPath || '', 'github.cfg')
  ]
  let owner = 'mpstore291'
  let repo = 'mp_controlpanel'
  let token = ''
  for (let i = 0; i < paths.length; i++) {
    const g = parseIni(paths[i])
    if (g.owner) owner = g.owner
    if (g.repo) repo = g.repo
    if (g.token) token = g.token
  }
  return { owner: owner, repo: repo, token: token }
}

function localVersion() {
  try {
    return String(require(path.join(codeRoot, '..', 'package.json')).version || '0.0.0')
  } catch (e) {
    return '0.0.0'
  }
}

function verParts(v) {
  return String(v || '').replace(/^v/i, '').split(/[.-]/).map(function (x) { return parseInt(x, 10) || 0 })
}

function verCmp(a, b) {
  const pa = verParts(a)
  const pb = verParts(b)
  const n = Math.max(pa.length, pb.length, 3)
  for (let i = 0; i < n; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return 1
    if ((pa[i] || 0) < (pb[i] || 0)) return -1
  }
  return 0
}

function ymlVal(text, key) {
  const re = new RegExp('^' + key + ':\\s*[\'"]?(\\S+)', 'm')
  const m = String(text || '').match(re)
  return m ? m[1].replace(/['"]/g, '') : ''
}

let versionGate = { ready: false, latest: false, current: '', remote: '', url: '', err: '' }
let versionWait = null

function ghFetch(url, ms) {
  const ac = new AbortController()
  const t = setTimeout(function () { ac.abort() }, ms || 8000)
  return fetch(url, {
    headers: {
      'User-Agent': 'MP-BotControle',
      Accept: 'application/vnd.github+json'
    },
    signal: ac.signal
  }).finally(function () { clearTimeout(t) })
}

async function readRemoteVersion(g) {
  const page = 'https://github.com/' + g.owner + '/' + g.repo + '/releases/latest'
  const yml = await ghFetch(page + '/download/latest.yml')
  if (yml.status === 404) return { remote: '', url: page, missing: true }
  if (yml.ok) {
    const text = await yml.text()
    const remote = ymlVal(text, 'version')
    const file = ymlVal(text, 'path')
    return {
      remote: remote,
      url: file ? (page + '/download/' + encodeURIComponent(file)) : page,
      missing: !remote
    }
  }
  const api = await ghFetch('https://api.github.com/repos/' + g.owner + '/' + g.repo + '/releases/latest')
  if (api.status === 404) return { remote: '', url: page, missing: true }
  if (!api.ok) throw new Error('github')
  const j = await api.json()
  const remote = String(j.tag_name || j.name || '').replace(/^v/i, '')
  let url = page
  const assets = j.assets || []
  for (let i = 0; i < assets.length; i++) {
    const n = String(assets[i].name || '')
    if (/\.exe$/i.test(n) && n.indexOf('latest') < 0) {
      url = assets[i].browser_download_url || url
      break
    }
  }
  return { remote: remote, url: url, missing: !remote }
}

function checkLatest(force) {
  if (force) versionWait = null
  if (versionWait) return versionWait
  versionWait = (async function () {
    const current = localVersion()
    const g = githubBits()
    const page = 'https://github.com/' + g.owner + '/' + g.repo + '/releases/latest'
    try {
      const info = await readRemoteVersion(g)
      if (info.missing || !info.remote) {
        versionGate = { ready: true, latest: true, current: current, remote: '', url: page, err: '' }
        return versionGate
      }
      const latest = verCmp(current, info.remote) >= 0
      versionGate = { ready: true, latest: latest, current: current, remote: info.remote, url: info.url || page, err: '' }
    } catch (e) {
      versionGate = { ready: true, latest: true, current: current, remote: '', url: page, err: '' }
    }
    return versionGate
  })()
  return versionWait
}

function blockedByVersion(g) {
  return process.env.DAMZ_PACKAGED === '1' && g && !g.latest
}

function machineId() {
  const f = path.join(dataRoot, 'machine.id')
  try {
    const v = fs.readFileSync(f, 'utf8').trim()
    if (v) return v
  } catch (e) {}
  const id = crypto.randomBytes(16).toString('hex')
  fs.writeFileSync(f, id)
  return id
}

function cookieUid(req) {
  const raw = String(req.headers.cookie || '')
  const parts = raw.split(';')
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i].trim()
    if (p.indexOf('uid=') === 0) return p.slice(4)
  }
  return ''
}

const logins = {}

function userSession(req) {
  const s = cookieUid(req)
  return (s && logins[s]) || null
}

function newUid(name, admin) {
  const id = crypto.randomBytes(16).toString('hex')
  logins[id] = { t: Date.now(), user: name, admin: !!admin }
  return id
}

function uidCookie(id) {
  return 'uid=' + id + '; Path=/; HttpOnly; SameSite=Lax'
}

function hashPass(pass, salt) {
  return crypto.scryptSync(String(pass), salt, 32)
}

function makeUser(name, pass, seats, devices) {
  const salt = crypto.randomBytes(16)
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', AUTH_KEY, iv)
  const enc = Buffer.concat([cipher.update(String(pass), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  const n = Math.max(1, Math.floor(Number(seats) || 1))
  return {
    user: String(name).trim(),
    salt: salt.toString('hex'),
    hash: hashPass(pass, salt).toString('hex'),
    box: iv.toString('hex') + '.' + tag.toString('hex') + '.' + enc.toString('hex'),
    seats: n,
    devices: Array.isArray(devices) ? devices : []
  }
}

function sealText(text) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', AUTH_KEY, iv)
  const enc = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return iv.toString('hex') + '.' + tag.toString('hex') + '.' + enc.toString('hex')
}

function openBox(box) {
  try {
    const p = String(box || '').split('.')
    if (p.length !== 3) return ''
    const decipher = crypto.createDecipheriv('aes-256-gcm', AUTH_KEY, Buffer.from(p[0], 'hex'))
    decipher.setAuthTag(Buffer.from(p[1], 'hex'))
    return Buffer.concat([decipher.update(Buffer.from(p[2], 'hex')), decipher.final()]).toString('utf8')
  } catch (e) {
    return ''
  }
}

function passOk(row, pass) {
  try {
    const got = hashPass(pass, Buffer.from(row.salt, 'hex'))
    const want = Buffer.from(row.hash, 'hex')
    if (got.length !== want.length) return false
    return crypto.timingSafeEqual(got, want)
  } catch (e) {
    return false
  }
}

let ghTokCache = ''

function saveGithubToken(tok) {
  const v = String(tok || '').trim()
  if (!v) return ''
  ghTokCache = v
  const cur = loadBot()
  fs.writeFileSync(path.join(dataRoot, 'bot.cfg'), dumpBot({
    token: cur.token,
    client_id: cur.client_id,
    server_id: cur.server_id,
    port: cur.port || '3784',
    github_token: v
  }))
  return v
}

function ghAuthToken() {
  return one(loadBot().github_token) || githubBits().token || ghTokCache
}

function ghHeaders(write) {
  const h = {
    'User-Agent': 'MP-BotControle',
    Accept: 'application/vnd.github+json'
  }
  const token = ghAuthToken()
  if (token) h.Authorization = 'Bearer ' + token
  else if (write) return null
  return h
}

async function ghRead() {
  const g = githubBits()
  const headers = ghHeaders(false)
  const r = await fetch('https://api.github.com/repos/' + g.owner + '/' + g.repo + '/contents/' + AUTH_FILE, { headers: headers })
  if (r.status === 404) return { users: [], sha: null, gtoken: '' }
  if (!r.ok) throw new Error('github')
  const j = await r.json()
  const raw = Buffer.from(String(j.content || '').replace(/\s/g, ''), 'base64').toString('utf8')
  let data
  try { data = JSON.parse(raw) } catch (e) { data = { users: [] } }
  if (!Array.isArray(data.users)) data.users = []
  const gtoken = data.gtoken ? String(data.gtoken) : ''
  const opened = openBox(gtoken)
  if (opened) ghTokCache = opened
  return { users: data.users, sha: j.sha, gtoken: gtoken }
}

async function ghWrite(users, sha, gtoken) {
  const headers = ghHeaders(true)
  if (!headers) throw new Error('github_token')
  headers['Content-Type'] = 'application/json'
  const g = githubBits()
  const payload = { users: users }
  if (gtoken) payload.gtoken = gtoken
  const body = {
    message: 'users',
    content: Buffer.from(JSON.stringify(payload)).toString('base64')
  }
  if (sha) body.sha = sha
  const r = await fetch('https://api.github.com/repos/' + g.owner + '/' + g.repo + '/contents/' + AUTH_FILE, {
    method: 'PUT',
    headers: headers,
    body: JSON.stringify(body)
  })
  if (r.status === 401 || r.status === 403) throw new Error('github_auth')
  if (!r.ok) throw new Error('github')
}

function ghFail(e) {
  const m = String(e && e.message)
  if (m === 'github_token') return 'Sæt GitHub token i feltet og tryk Gem token'
  if (m === 'github_auth') return 'GitHub token virker ikke. Den skal have write til mp_controlpanel'
  return 'Kunne ikke gemme på GitHub'
}

function allowed(req) {
  const who = userSession(req)
  if (!who || who.admin) return false
  if (one(loadBot().token)) return true
  return authed(req)
}

function newSid() {
  const id = crypto.randomBytes(16).toString('hex')
  sessions[id] = Date.now()
  return id
}

function send(res, code, type, body, extra) {
  const headers = {
    'Content-Type': type,
    'Cache-Control': 'no-store'
  }
  if (extra) {
    const ks = Object.keys(extra)
    for (let i = 0; i < ks.length; i++) headers[ks[i]] = extra[ks[i]]
  }
  res.writeHead(code, headers)
  res.end(body)
}

function readBody(req, cb) {
  let buf = ''
  req.on('data', function (c) {
    buf += c
    if (buf.length > 2000000) req.destroy()
  })
  req.on('end', function () { cb(buf) })
  req.on('error', function () { cb('') })
}

async function checkToken(token) {
  const r = await fetch('https://discord.com/api/v10/applications/@me', {
    headers: { Authorization: 'Bot ' + token }
  })
  if (!r.ok) throw new Error('token')
  return r.json()
}

function lanIps() {
  const out = []
  const nics = os.networkInterfaces()
  const ks = Object.keys(nics)
  for (let i = 0; i < ks.length; i++) {
    const list = nics[ks[i]] || []
    for (let j = 0; j < list.length; j++) {
      const a = list[j]
      if (a.family === 'IPv4' && !a.internal) out.push(a.address)
    }
  }
  return out
}

const server = http.createServer(function (req, res) {
  const url = req.url.split('?')[0]
  if (req.method === 'GET' && url === '/icon.png') {
    const p = path.join(codeRoot, 'icon.png')
    if (fs.existsSync(p)) {
      send(res, 200, 'image/png', fs.readFileSync(p))
      return
    }
  }
  if (req.method === 'GET' && (url === '/' || url === '/index.html')) {
    send(res, 200, 'text/html; charset=utf-8', fs.readFileSync(path.join(codeRoot, 'index.html')))
    return
  }
  if (req.method === 'GET' && url === '/api/boot') {
    const retry = String(req.url).indexOf('retry=1') >= 0
    checkLatest(retry).then(function (g) {
      send(res, 200, 'application/json; charset=utf-8', JSON.stringify({
        ok: true,
        latest: !!g.latest,
        mustInstall: process.env.DAMZ_PACKAGED === '1' && !g.latest,
        current: g.current,
        remote: g.remote,
        url: g.url,
        err: g.err || ''
      }))
    })
    return
  }
  if (req.method === 'GET' && url === '/api/state') {
    const who = userSession(req)
    if (!who) {
      send(res, 200, 'application/json; charset=utf-8', JSON.stringify({ step: 'login' }))
      return
    }
    if (who.admin) {
      send(res, 200, 'application/json; charset=utf-8', JSON.stringify({
        step: 'admin',
        admin: true,
        user: who.user
      }))
      return
    }
    const bot = loadBot()
    if (!one(bot.token)) {
      send(res, 200, 'application/json; charset=utf-8', JSON.stringify({
        step: 'token',
        admin: false,
        user: who.user,
        online: false
      }))
      return
    }
    startBot().catch(function (e) { console.log(e) }).then(function () {
      return waitReady(20000)
    }).then(function (ok) {
      if (!ok) {
        send(res, 200, 'application/json; charset=utf-8', JSON.stringify({
          step: 'token',
          admin: false,
          user: who.user,
          online: false,
          err: 'Bot kunne ikke starte'
        }))
        return
      }
      return discordBits().then(function (bits) {
        const cur = loadBot()
        const step = cur.server_id && bits.guild ? 'app' : 'guild'
        send(res, 200, 'application/json; charset=utf-8', JSON.stringify({
          step: step,
          admin: false,
          user: who.user,
          online: true,
          bot: client && client.user ? client.user.tag : '',
          guilds: guildList(),
          server_id: cur.server_id || '',
          roles: bits.roles,
          categories: bits.categories,
          channels: bits.channels,
          guild: bits.guild,
          config: cfgState()
        }))
      })
    }).catch(function (e) {
      console.log(e)
      send(res, 500, 'application/json', JSON.stringify({ step: 'token' }))
    })
    return
  }
  if (req.method === 'POST' && url === '/api/user-login') {
    readBody(req, function (raw) {
      let data
      try { data = JSON.parse(raw) } catch (e) { send(res, 400, 'application/json', JSON.stringify({ ok: false })); return }
      const name = String(data.user || '').trim()
      const pass = String(data.pass || '')
      checkLatest().then(function (g) {
      if (blockedByVersion(g)) {
        const err = g.err === 'check' ? 'Kunne ikke tjekke version' : 'Installer den nyeste version'
        send(res, 400, 'application/json', JSON.stringify({ ok: false, err: err }))
        return
      }
      const done = function (admin) {
        const id = newUid(name, admin)
        send(res, 200, 'application/json; charset=utf-8', JSON.stringify({ ok: true, admin: !!admin }), {
          'Set-Cookie': uidCookie(id)
        })
      }
      if (name === ADMIN_USER && pass === ADMIN_PASS) {
        done(true)
        return
      }
      ghRead().then(function (pack) {
        let row = null
        let idx = -1
        for (let i = 0; i < pack.users.length; i++) {
          if (pack.users[i].user === name) {
            row = pack.users[i]
            idx = i
          }
        }
        if (!row || !passOk(row, pass)) {
          send(res, 400, 'application/json', JSON.stringify({ ok: false, err: 'Forkert login' }))
          return
        }
        const mid = machineId()
        const seats = Math.max(1, Math.floor(Number(row.seats) || 1))
        const devices = Array.isArray(row.devices) ? row.devices.slice() : []
        let known = false
        for (let d = 0; d < devices.length; d++) {
          if (devices[d] === mid) known = true
        }
        if (!known) {
          if (devices.length >= seats) {
            send(res, 400, 'application/json', JSON.stringify({ ok: false, err: 'Login er allerede i brug på en anden pc' }))
            return
          }
          devices.push(mid)
          pack.users[idx] = Object.assign({}, row, { devices: devices, seats: seats })
          return ghWrite(pack.users, pack.sha, pack.gtoken).then(function () { done(false) })
        }
        done(false)
      }).catch(function (e) {
        const msg = String(e && e.message) === 'github_token' ? 'GitHub token mangler under Brugere' : 'Kunne ikke tjekke login'
        send(res, 400, 'application/json', JSON.stringify({ ok: false, err: msg }))
      })
      })
    })
    return
  }
  if (req.method === 'GET' && url === '/api/admin/users') {
    const who = userSession(req)
    if (!who || !who.admin) { send(res, 401, 'application/json', JSON.stringify({ ok: false })); return }
    ghRead().then(function (pack) {
      const list = []
      for (let i = 0; i < pack.users.length; i++) {
        const u = pack.users[i]
        list.push({
          user: u.user,
          pass: openBox(u.box),
          seats: Math.max(1, Math.floor(Number(u.seats) || 1)),
          pcs: Array.isArray(u.devices) ? u.devices.length : 0
        })
      }
      send(res, 200, 'application/json; charset=utf-8', JSON.stringify({
        ok: true,
        users: list,
        hasToken: !!one(loadBot().github_token)
      }))
    }).catch(function () {
      send(res, 400, 'application/json', JSON.stringify({ ok: false, err: 'GitHub fejlede' }))
    })
    return
  }
  if (req.method === 'POST' && url === '/api/admin/github-token') {
    const who = userSession(req)
    if (!who || !who.admin) { send(res, 401, 'application/json', JSON.stringify({ ok: false })); return }
    readBody(req, function (raw) {
      let data
      try { data = JSON.parse(raw) } catch (e) { send(res, 400, 'application/json', JSON.stringify({ ok: false })); return }
      const tok = String(data.token || '').trim()
      if (!tok) {
        send(res, 400, 'application/json', JSON.stringify({ ok: false, err: 'Sæt GitHub token i feltet' }))
        return
      }
      saveGithubToken(tok)
      ghRead().then(function (pack) {
        return ghWrite(pack.users, pack.sha, sealText(tok))
      }).then(function () {
        send(res, 200, 'application/json', JSON.stringify({ ok: true }))
      }).catch(function (e) {
        send(res, 400, 'application/json', JSON.stringify({ ok: false, err: ghFail(e) }))
      })
    })
    return
  }
  if (req.method === 'POST' && url === '/api/admin/users') {
    const who = userSession(req)
    if (!who || !who.admin) { send(res, 401, 'application/json', JSON.stringify({ ok: false })); return }
    readBody(req, function (raw) {
      let data
      try { data = JSON.parse(raw) } catch (e) { send(res, 400, 'application/json', JSON.stringify({ ok: false })); return }
      const name = String(data.user || '').trim()
      const pass = String(data.pass || '')
      const seats = Math.max(1, Math.floor(Number(data.seats) || 1))
      if (data.token) saveGithubToken(data.token)
      if (!name || !pass) {
        send(res, 400, 'application/json', JSON.stringify({ ok: false, err: 'Udfyld bruger og kode' }))
        return
      }
      if (name === ADMIN_USER) {
        send(res, 400, 'application/json', JSON.stringify({ ok: false, err: 'Den bruger er reserveret' }))
        return
      }
      ghRead().then(function (pack) {
        const next = []
        let found = false
        for (let i = 0; i < pack.users.length; i++) {
          if (pack.users[i].user === name) {
            next.push(makeUser(name, pass, seats, pack.users[i].devices))
            found = true
          } else next.push(pack.users[i])
        }
        if (!found) next.push(makeUser(name, pass, seats, []))
        return ghWrite(next, pack.sha, pack.gtoken || sealText(ghAuthToken()))
      }).then(function () {
        send(res, 200, 'application/json', JSON.stringify({ ok: true }))
      }).catch(function (e) {
        send(res, 400, 'application/json', JSON.stringify({ ok: false, err: ghFail(e) }))
      })
    })
    return
  }
  if (req.method === 'POST' && url === '/api/admin/users/delete') {
    const who = userSession(req)
    if (!who || !who.admin) { send(res, 401, 'application/json', JSON.stringify({ ok: false })); return }
    readBody(req, function (raw) {
      let data
      try { data = JSON.parse(raw) } catch (e) { send(res, 400, 'application/json', JSON.stringify({ ok: false })); return }
      const name = String(data.user || '').trim()
      ghRead().then(function (pack) {
        const next = pack.users.filter(function (u) { return u.user !== name })
        return ghWrite(next, pack.sha, pack.gtoken)
      }).then(function () {
        send(res, 200, 'application/json', JSON.stringify({ ok: true }))
      }).catch(function (e) {
        send(res, 400, 'application/json', JSON.stringify({ ok: false, err: ghFail(e) }))
      })
    })
    return
  }
  if (req.method === 'POST' && url === '/api/admin/users/reset-pc') {
    const who = userSession(req)
    if (!who || !who.admin) { send(res, 401, 'application/json', JSON.stringify({ ok: false })); return }
    readBody(req, function (raw) {
      let data
      try { data = JSON.parse(raw) } catch (e) { send(res, 400, 'application/json', JSON.stringify({ ok: false })); return }
      const name = String(data.user || '').trim()
      ghRead().then(function (pack) {
        const next = pack.users.map(function (u) {
          if (u.user !== name) return u
          return Object.assign({}, u, { devices: [] })
        })
        return ghWrite(next, pack.sha, pack.gtoken)
      }).then(function () {
        send(res, 200, 'application/json', JSON.stringify({ ok: true }))
      }).catch(function (e) {
        send(res, 400, 'application/json', JSON.stringify({ ok: false, err: ghFail(e) }))
      })
    })
    return
  }
  if (req.method === 'POST' && url === '/api/login') {
    const who = userSession(req)
    if (!who || who.admin) { send(res, 401, 'application/json', JSON.stringify({ ok: false })); return }
    readBody(req, function (raw) {
      let data
      try { data = JSON.parse(raw) } catch (e) { send(res, 400, 'application/json', JSON.stringify({ ok: false })); return }
      const token = String(data.token || '').trim()
      const saved = one(loadBot().token)
      const go = function () {
        const sid = newSid()
        startBot().then(function () {
          send(res, 200, 'application/json; charset=utf-8', JSON.stringify({ ok: true, guilds: guildList() }), {
            'Set-Cookie': 'sid=' + sid + '; Path=/; HttpOnly; SameSite=Lax'
          })
        }).catch(function (e) {
          console.log(e)
          send(res, 400, 'application/json', JSON.stringify({ ok: false, err: 'Bot kunne ikke starte' }))
        })
      }
      if (saved && token === saved) {
        go()
        return
      }
      checkToken(token).then(function (app) {
        const cur = loadBot()
        fs.writeFileSync(path.join(dataRoot, 'bot.cfg'), dumpBot({
          token: token,
          client_id: app.id,
          server_id: cur.server_id || '',
          port: cur.port || '3784',
          github_token: cur.github_token
        }))
        go()
      }).catch(function () {
        send(res, 400, 'application/json', JSON.stringify({ ok: false, err: 'Ugyldig token' }))
      })
    })
    return
  }
  if (req.method === 'POST' && url === '/api/guild') {
    if (!allowed(req)) { send(res, 401, 'application/json', JSON.stringify({ ok: false })); return }
    readBody(req, function (raw) {
      let data
      try { data = JSON.parse(raw) } catch (e) { send(res, 400, 'application/json', JSON.stringify({ ok: false })); return }
      const id = String(data.id || '').trim()
      const cur = loadBot()
      fs.writeFileSync(path.join(dataRoot, 'bot.cfg'), dumpBot({
        token: cur.token,
        client_id: cur.client_id,
        server_id: id,
        port: cur.port || '3784',
        github_token: cur.github_token
      }))
      registerCommands().catch(function (e) { console.log(e) })
      discordBits().then(function (bits) {
        send(res, 200, 'application/json; charset=utf-8', JSON.stringify({ ok: true, bits: bits }))
      })
    })
    return
  }
  if (req.method === 'POST' && url === '/api/save') {
    if (!allowed(req)) { send(res, 401, 'application/json', JSON.stringify({ ok: false })); return }
    readBody(req, function (raw) {
      let data
      try { data = JSON.parse(raw) } catch (e) { send(res, 400, 'application/json', JSON.stringify({ ok: false })); return }
      const cur = cfgState()
      cur.log_channel = data.log_channel
      cur.staff_roles = data.staff_roles
      if (Array.isArray(data.categories)) cur.categories = data.categories
      if (Array.isArray(data.panels)) cur.panels = data.panels
      fs.writeFileSync(path.join(dataRoot, 'config.cfg'), dumpCfg(cur))
      registerCommands().catch(function (e) { console.log(e) })
      send(res, 200, 'application/json', JSON.stringify({ ok: true }))
    })
    return
  }
  if (req.method === 'POST' && url === '/api/sync') {
    if (!allowed(req)) { send(res, 401, 'application/json', JSON.stringify({ ok: false })); return }
    discordBits().then(function (bits) {
      send(res, 200, 'application/json; charset=utf-8', JSON.stringify({ ok: true, bits: bits }))
    }).catch(function (e) {
      console.log(e)
      send(res, 500, 'application/json', JSON.stringify({ ok: false }))
    })
    return
  }
  if (req.method === 'POST' && url === '/api/restart') {
    if (!allowed(req)) { send(res, 401, 'application/json', JSON.stringify({ ok: false })); return }
    startBot().then(function () {
      send(res, 200, 'application/json', JSON.stringify({ ok: true, bot: client && client.user ? client.user.tag : '' }))
    }).catch(function (e) {
      console.log(e)
      send(res, 400, 'application/json', JSON.stringify({ ok: false }))
    })
    return
  }
  if (req.method === 'GET' && url === '/api/logs') {
    if (!allowed(req)) { send(res, 401, 'application/json', JSON.stringify({ ok: false })); return }
    send(res, 200, 'application/json; charset=utf-8', JSON.stringify({ lines: logs }))
    return
  }
  send(res, 404, 'text/plain', 'not found')
})

const PORT = Number(one(loadBot().port) || 3784)

server.on('error', function (e) {
  if (e.code === 'EADDRINUSE') {
    console.log('port ' + PORT + ' er optaget. Luk den anden bot-proces og start start.bat igen.')
    process.exit(1)
  }
  console.log(e)
  process.exit(1)
})

server.listen(PORT, '0.0.0.0', function () {
  console.log('panel http://127.0.0.1:' + PORT)
  const ips = lanIps()
  for (let i = 0; i < ips.length; i++) console.log('panel http://' + ips[i] + ':' + PORT)
})
