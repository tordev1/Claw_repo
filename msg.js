#!/usr/bin/env node
// msg.js — send/read messages in terminal
// Usage:
//   node msg.js "hello coworker"          ← send to #general
//   node msg.js                           ← read last 20 messages
//   node msg.js --channel project-xxx "hi" ← send to specific channel

const http = require('http');

const API = 'http://localhost:3001';
const args = process.argv.slice(2);

let channelId = 'general';
let message   = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--channel' || args[i] === '-c') { channelId = args[++i]; }
  else { message = args[i]; }
}

function req(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request(
      new URL(path, API),
      { method, headers: { 'Content-Type': 'application/json', ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}), ...(token ? { 'Authorization': 'Bearer ' + token } : {}) } },
      res => { let b = ''; res.on('data', c => b += c); res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(b) }); } catch { resolve({ status: res.statusCode, body: b }); } }); }
    );
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

const COLORS = { reset: '\x1b[0m', cyan: '\x1b[36m', green: '\x1b[32m', yellow: '\x1b[33m', gray: '\x1b[90m', bold: '\x1b[1m' };

(async () => {
  // Login
  const login = await req('POST', '/api/auth/login', { login: 'Scorpion', password: 'Scorpion123' });
  const token = login.body.session?.token;
  if (!token) { console.error('Auth failed'); process.exit(1); }

  if (message) {
    // Send
    const res = await req('POST', `/api/channels/${channelId}/messages`, { content: message }, token);
    if (res.status === 200 || res.status === 201) {
      console.log(`${COLORS.green}✓${COLORS.reset} Sent to #${channelId}: ${message}`);
    } else {
      console.error('Error:', res.body);
    }
  } else {
    // Read
    const res  = await req('GET', `/api/channels/${channelId}/messages?limit=20`, null, token);
    const msgs = Array.isArray(res.body) ? res.body : (res.body.messages || []);
    if (!msgs.length) { console.log('No messages.'); return; }

    console.log(`\n${COLORS.bold}#${channelId}${COLORS.reset} — last ${msgs.length} messages\n`);
    msgs.forEach(m => {
      const who  = m.sender_name || m.user_name || m.agent_name || '?';
      const icon = m.sender_type === 'agent' ? '🤖' : '👤';
      const time = m.created_at ? new Date(m.created_at).toLocaleTimeString() : '';
      console.log(`${COLORS.gray}[${time}]${COLORS.reset} ${icon} ${COLORS.cyan}${who}${COLORS.reset}: ${m.content}`);
    });
    console.log();
  }
})().catch(e => { console.error(e.message); process.exit(1); });
