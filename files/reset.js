const fs = require('fs')
const path = require('path')

const root = process.env.DAMZ_DATA || __dirname

fs.writeFileSync(path.join(root, 'bot.cfg'), 'token=\nclient_id=\nserver_id=\nport=3784\n')
fs.writeFileSync(path.join(root, 'config.cfg'), [
  'log_channel=',
  'staff_roles=',
  'color=#5865F2',
  'footer=',
  'max_tickets=1',
  '',
  'dropdown=',
  '',
  'close_button=Close',
  'close_emoji=',
  'claim_button=Claim',
  'claim_emoji=',
  '',
  'close_title=Close ticket',
  'close_reason=Close Reason',
  'ticket_title=Ticket Created',
  ''
].join('\n'))

try { fs.unlinkSync(path.join(root, 'tickets.json')) } catch (e) {}
