#!/usr/bin/env node
/**
 * notifier.js — Project Claw → Telegram notifier + slash command handler
 *
 * Connects to the Project Claw WebSocket server, listens for task/project/agent
 * events, and sends Telegram messages to the admin chat.
 * Also polls Telegram getUpdates to handle slash commands from the admin.
 *
 * Usage: node scripts/notifier.js
 * Runs as a long-lived background process (managed by start-local.sh).
 */

'use strict';

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');

// Load env vars from scripts/.env if present, then api-server/.env as fallback
const dotenvPath = path.join(__dirname, '..', 'api-server', 'node_modules', 'dotenv');
try { require(dotenvPath).config({ path: path.join(__dirname, '.env') }); } catch (_) {}
try { require(dotenvPath).config({ path: path.join(__dirname, '..', 'api-server', '.env') }); } catch (_) {}
const { setTimeout: sleep } = require('timers/promises');
const WebSocket = require('../api-server/node_modules/ws');

// ─── Single-instance lockfile ─────────────────────────────────────────────────
// Prevents duplicate notifications when multiple processes are accidentally started.

const REPO_ROOT = path.resolve(__dirname, '..');
const LOCK_FILE = path.join(REPO_ROOT, 'logs', 'notifier.lock');

function acquireLock() {
  // Ensure logs dir exists
  fs.mkdirSync(path.join(REPO_ROOT, 'logs'), { recursive: true });

  if (fs.existsSync(LOCK_FILE)) {
    const existingPid = parseInt(fs.readFileSync(LOCK_FILE, 'utf8').trim(), 10);
    if (existingPid && existingPid !== process.pid) {
      let alive = false;
      try {
        process.kill(existingPid, 0);
        alive = true;
      } catch (e) {
        // ESRCH = no such process (stale lock)
        // EPERM = process exists but no permission to signal (still alive on Windows)
        alive = (e.code === 'EPERM');
      }
      if (alive) {
        console.error(`[notifier] Already running (PID ${existingPid}). Exiting.`);
        process.exit(0);
      }
      console.log(`[notifier] Stale lock (PID ${existingPid} dead). Taking over.`);
    }
  }

  fs.writeFileSync(LOCK_FILE, String(process.pid), 'utf8');
  console.log(`[notifier] Lock acquired (PID ${process.pid})`);

  const cleanup = () => { try { fs.unlinkSync(LOCK_FILE); } catch (_) {} };
  process.on('exit',             cleanup);
  process.on('SIGINT',           () => process.exit(0));
  process.on('SIGTERM',          () => process.exit(0));
  process.on('uncaughtException', (err) => {
    console.error('[notifier] Uncaught exception:', err.message);
    cleanup();
    process.exit(1);
  });
}

acquireLock();

// ─── Config ───────────────────────────────────────────────────────────────────

const API_BASE           = process.env.API_BASE   || 'http://localhost:3001';
const WS_BASE            = process.env.WS_BASE    || 'ws://localhost:3001';
const TG_TOKEN           = process.env.TG_TOKEN;
const TG_CHAT_ID         = process.env.TG_CHAT_ID;

if (!TG_TOKEN || !TG_CHAT_ID) {
  console.error('[notifier] Missing TG_TOKEN or TG_CHAT_ID env vars. Set them in scripts/.env or environment.');
  process.exit(1);
}
const RECONNECT_DELAY_MS = 5000;
const MAX_RECONNECT_MS   = 60000;
const PING_INTERVAL_MS   = 20000;

// ─── HTTP helper ──────────────────────────────────────────────────────────────

function httpRequest(method, url, body, authToken) {
  return new Promise((resolve, reject) => {
    const parsed  = new URL(url);
    const lib     = parsed.protocol === 'https:' ? https : http;
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: parsed.hostname,
      port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path:     parsed.pathname + (parsed.search || ''),
      method:   method.toUpperCase(),
      headers:  { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    };
    if (authToken) options.headers['Authorization'] = `Bearer ${authToken}`;
    if (payload) options.headers['Content-Length'] = Buffer.byteLength(payload);
    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end',  () => resolve({ statusCode: res.statusCode, body: data }));
    });
    req.setTimeout(15000, () => { req.destroy(new Error('HTTP request timeout')); });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function parseJSON(raw) {
  try { return JSON.parse(raw); } catch (_) { return null; }
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

let cachedToken = null;

async function getToken() {
  if (cachedToken) return cachedToken;
  const res  = await httpRequest('POST', `${API_BASE}/api/auth/login`, {
    login: 'Scorpion', password: 'Scorpion123',
  });
  const body = parseJSON(res.body);
  if (res.statusCode !== 200 || !body) {
    cachedToken = null; // clear stale cache so next call retries
    throw new Error(`Auth failed (${res.statusCode}): ${res.body}`);
  }
  const token =
    body.access_token ||
    body.token        ||
    body.accessToken  ||
    (body.session && body.session.token);
  if (!token) throw new Error(`No token in auth response: ${res.body}`);
  cachedToken = token;
  setTimeout(() => { cachedToken = null; }, 13 * 60 * 1000);
  return token;
}

// ─── Telegram ─────────────────────────────────────────────────────────────────

async function sendTelegram(text) {
  try {
    const res = await httpRequest('POST', `https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      chat_id: TG_CHAT_ID, text, parse_mode: 'HTML',
    });
    if (res.statusCode !== 200) {
      console.error(`[notifier] Telegram error ${res.statusCode}: ${res.body}`);
    } else {
      STATS.sent++;
    }
  } catch (err) {
    console.error(`[notifier] Telegram send failed: ${err.message}`);
  }
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─── Event formatters ─────────────────────────────────────────────────────────

function formatTaskCompleted(p) {
  const title   = p.task_title  || p.title   || 'Unknown task';
  const project = p.project_name || p.project || '';
  const agent   = p.agent_name  || p.agent   || '';
  const result  = p.result || '';
  const lines   = [
    `✅ <b>Task completed</b>: ${escapeHtml(title)}`,
    project ? `📁 Project: ${escapeHtml(project)}` : '',
    agent   ? `🤖 Agent: ${escapeHtml(agent)}`     : '',
  ];
  if (result) {
    const snippet = result.length > 200 ? result.slice(0, 200) + '…' : result;
    lines.push(`\n📝 ${escapeHtml(snippet)}`);
  }
  return lines.filter(Boolean).join('\n');
}

// ─── Stats ────────────────────────────────────────────────────────────────────

const STATS = {
  startedAt: Date.now(),
  sent: 0,
  events: { 'task:completed': 0, 'task:assigned': 0, 'task:rejected': 0, 'project:created': 0, 'agent:assigned_to_project': 0 },
};

// Expose stats on a small HTTP server so HQ dashboard can poll it
const STATS_PORT = 13099;
const statsServer = http.createServer((req, res) => {
  if (req.url === '/stats' || req.url === '/') {
    const uptimeSec = Math.floor((Date.now() - STATS.startedAt) / 1000);
    const body = JSON.stringify({ ...STATS, uptimeSec });
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(body);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});
statsServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    // Another notifier instance owns this port — hard stop to prevent duplicate notifications
    console.error(`[notifier] Stats port ${STATS_PORT} already in use — another instance is running. Exiting.`);
    try { fs.unlinkSync(LOCK_FILE); } catch (_) {}
    process.exit(0);
  }
  console.warn(`[notifier] Stats server error (${err.code}) — continuing without stats`);
});
statsServer.listen(STATS_PORT, '127.0.0.1', () => {
  console.log(`[notifier] Stats server on http://127.0.0.1:${STATS_PORT}/stats`);
});

// ─── Dedup cache ──────────────────────────────────────────────────────────────
// Prevents firing the same notification twice if the WS reconnects mid-event.

const seen    = new Map(); // key → timestamp
const SEEN_TTL = 60 * 1000; // 60s

function isDuplicate(key) {
  const now = Date.now();
  // Prune old entries
  for (const [k, t] of seen) { if (now - t > SEEN_TTL) seen.delete(k); }
  if (seen.has(key)) return true;
  seen.set(key, now);
  return false;
}

// ─── Message dispatcher ───────────────────────────────────────────────────────

function dispatch(msg) {
  const type    = msg.type || msg.event || msg.event_type;
  const payload = msg.data || msg.payload || msg;

  if (type === 'task:completed' || payload.event_type === 'task_completed') {
    const p   = (msg.data || msg.payload) ? payload : msg;
    const key = `completed:${p.task_id || p.id}`;
    if (isDuplicate(key)) return;
    STATS.events['task:completed']++;
    console.log(`[notifier] task:completed → ${p.task_title || p.title || p.task_id}`);
    sendTelegram(formatTaskCompleted(p)).catch(() => {});

  } else if (type === 'task:assigned' || type === 'agent:task_assigned') {
    const title = payload.task_title || payload.title || '';
    if (!title) return;
    const key = `assigned:${payload.task_id}`;
    if (isDuplicate(key)) return;
    STATS.events['task:assigned']++;
    const agent = payload.agent_name || '';
    const proj  = payload.project_name || '';
    const text  = [
      `📋 <b>Task assigned</b>: ${escapeHtml(title)}`,
      agent ? `🤖 Agent: ${escapeHtml(agent)}`   : '',
      proj  ? `📁 Project: ${escapeHtml(proj)}`  : '',
    ].filter(Boolean).join('\n');
    console.log(`[notifier] task:assigned → ${title}`);
    sendTelegram(text).catch(() => {});

  } else if (type === 'task:rejected') {
    const title = payload.task_title || payload.title || '';
    const key   = `rejected:${payload.task_id}`;
    if (isDuplicate(key)) return;
    STATS.events['task:rejected']++;
    const agent = payload.agent_name || '';
    const text  = [
      `❌ <b>Task rejected</b>: ${escapeHtml(title)}`,
      agent ? `🤖 by ${escapeHtml(agent)}` : '',
    ].filter(Boolean).join('\n');
    console.log(`[notifier] task:rejected → ${title}`);
    sendTelegram(text).catch(() => {});

  } else if (type === 'project:created') {
    const name = payload.project_name || payload.name || payload.project_id || '';
    const key  = `project:${payload.project_id || name}`;
    if (isDuplicate(key)) return;
    STATS.events['project:created']++;
    console.log(`[notifier] project:created → ${name}`);
    sendTelegram(`🚀 <b>New project</b>: ${escapeHtml(name)}`).catch(() => {});

  } else if (type === 'agent:assigned_to_project') {
    const agent = payload.agent_name || '';
    const proj  = payload.project_name || '';
    const key   = `agent-proj:${payload.agent_id}:${payload.project_id}`;
    if (!agent || !proj || isDuplicate(key)) return;
    STATS.events['agent:assigned_to_project']++;
    console.log(`[notifier] agent:assigned_to_project → ${agent} → ${proj}`);
    sendTelegram(`🔗 <b>${escapeHtml(agent)}</b> joined project <b>${escapeHtml(proj)}</b>`).catch(() => {});
  }
}

// ─── Reconnect loop ───────────────────────────────────────────────────────────

async function run() {
  let delay = RECONNECT_DELAY_MS;

  while (true) {
    let token;
    try {
      token = await getToken();
    } catch (err) {
      console.error(`[notifier] Auth failed: ${err.message} — retrying in ${delay / 1000}s`);
      await sleep(delay);
      delay = Math.min(delay * 2, MAX_RECONNECT_MS);
      continue;
    }

    console.log('[notifier] Connecting to Project Claw WebSocket...');

    await new Promise((resolve) => {
      const ws = new WebSocket(`${WS_BASE}/ws?token=${token}`);

      const ping = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.ping();
      }, PING_INTERVAL_MS);

      ws.on('open', () => {
        console.log('[notifier] Connected. Listening for events.');
        delay = RECONNECT_DELAY_MS; // reset backoff
      });

      ws.on('message', (data) => {
        let msg;
        try { msg = JSON.parse(data.toString()); } catch (_) { return; }
        dispatch(msg);
      });

      ws.on('pong', () => {
        // server acknowledged our ping — connection is alive
      });

      ws.on('error', (err) => {
        console.error(`[notifier] WS error: ${err.message}`);
      });

      ws.on('close', (code, reason) => {
        clearInterval(ping);
        console.log(`[notifier] WS closed (${code}) — reconnecting in ${delay / 1000}s`);
        resolve();
      });
    });

    await sleep(delay);
    delay = Math.min(delay * 2, MAX_RECONNECT_MS);
  }
}

// ─── Telegram slash command handler ──────────────────────────────────────────

async function apiCall(method, endpoint, body) {
  const token = await getToken();
  const res   = await httpRequest(method, `${API_BASE}${endpoint}`, body, token);
  const parsed = parseJSON(res.body);
  if (res.statusCode === 401) {
    // Token expired — clear and retry once
    cachedToken = null;
    const fresh = await getToken();
    const res2  = await httpRequest(method, `${API_BASE}${endpoint}`, body, fresh);
    return parseJSON(res2.body);
  }
  return parsed;
}

async function handleSlashCommand(text, chatId) {
  const parts = text.trim().split(/\s+/);
  const cmd   = (parts[0] || '').toLowerCase().replace('@tor_dev2bot', '');

  console.log(`[notifier] slash command: ${cmd}`);

  try {
    if (cmd === '/help') {
      await sendTelegramTo(chatId, [
        '🤖 <b>Project Claw commands</b>',
        '',
        '/status — system health &amp; agent counts',
        '/agents — list all agents',
        '/projects — list all projects',
        '/project &lt;id&gt; — project details',
        '/tasks — recent tasks (all projects)',
        '/tasks &lt;projectId&gt; — tasks in a project',
        '/newtask &lt;projectId&gt; "title" — create a task',
        '/execute &lt;taskId&gt; — run a task via AI',
        '/help — show this list',
      ].join('\n'));

    } else if (cmd === '/status') {
      const [health, agentsData] = await Promise.all([
        apiCall('GET', '/api/health', null).catch(() => ({})),
        apiCall('GET', '/api/agents', null).catch(() => ({ agents: [] })),
      ]);
      const list    = agentsData.agents || agentsData || [];
      const online  = list.filter(a => a.status === 'online').length;
      const upSec   = health.uptime ? Math.floor(health.uptime) : 0;
      const upStr   = upSec > 3600
        ? `${Math.floor(upSec / 3600)}h ${Math.floor((upSec % 3600) / 60)}m`
        : `${Math.floor(upSec / 60)}m`;
      await sendTelegramTo(chatId, [
        `🟢 <b>Project Claw — Online</b>`,
        `⏱ Uptime: ${upStr}`,
        `🤖 Agents: ${online}/${list.length} online`,
        `🗄 DB: ${health.database || 'connected'}`,
      ].join('\n'));

    } else if (cmd === '/agents') {
      const data = await apiCall('GET', '/api/agents', null);
      const list = data.agents || data || [];
      if (!list.length) { await sendTelegramTo(chatId, 'No agents registered.'); return; }
      const lines = list.map(a => {
        const icon = a.status === 'online' ? '🟢' : '🔴';
        return `${icon} <b>${escapeHtml(a.name)}</b> (${a.handle}) — ${a.agent_type || 'worker'}`;
      });
      await sendTelegramTo(chatId, `<b>Agents (${list.length})</b>\n\n` + lines.join('\n'));

    } else if (cmd === '/projects') {
      const data = await apiCall('GET', '/api/projects', null);
      const list = data.projects || data || [];
      if (!list.length) { await sendTelegramTo(chatId, 'No projects found.'); return; }
      const lines = list.map(p => {
        const stats = p.stats || {};
        return `📁 <b>${escapeHtml(p.name)}</b>\n   ID: <code>${p.id}</code> · ${stats.completedTasks || 0}/${stats.totalTasks || 0} tasks done`;
      });
      await sendTelegramTo(chatId, `<b>Projects (${list.length})</b>\n\n` + lines.join('\n\n'));

    } else if (cmd === '/project') {
      const id = parts[1];
      if (!id) { await sendTelegramTo(chatId, 'Usage: /project &lt;id&gt;'); return; }
      const p = await apiCall('GET', `/api/projects/${id}`, null);
      const stats = p.stats || {};
      await sendTelegramTo(chatId, [
        `📁 <b>${escapeHtml(p.name)}</b>`,
        p.description ? escapeHtml(p.description) : '',
        `Status: ${p.status}`,
        `Tasks: ${stats.completedTasks || 0} done / ${stats.totalTasks || 0} total`,
        `ID: <code>${p.id}</code>`,
      ].filter(Boolean).join('\n'));

    } else if (cmd === '/tasks') {
      const projectId = parts[1];
      const endpoint  = projectId ? `/api/tasks?project_id=${projectId}&limit=10` : '/api/tasks?limit=10';
      const data      = await apiCall('GET', endpoint, null);
      const list      = data.tasks || data || [];
      if (!list.length) { await sendTelegramTo(chatId, 'No tasks found.'); return; }
      const statusIcon = s => ({ completed: '✅', running: '⚙️', pending: '⏳', failed: '❌', cancelled: '🚫' }[s] || '❓');
      const lines = list.map(t =>
        `${statusIcon(t.status)} <b>${escapeHtml(t.title)}</b>\n   ID: <code>${t.id.slice(0, 8)}</code> · ${t.agent_name ? `🤖 ${escapeHtml(t.agent_name)}` : 'unassigned'}`
      );
      await sendTelegramTo(chatId, `<b>Tasks</b>\n\n` + lines.join('\n\n'));

    } else if (cmd === '/newtask') {
      // /newtask <projectId> "title" ["description"]
      const projectId = parts[1];
      if (!projectId) { await sendTelegramTo(chatId, 'Usage: /newtask &lt;projectId&gt; "title" ["description"]'); return; }
      // Extract quoted strings or remaining words
      const rest    = parts.slice(2).join(' ');
      const matches = rest.match(/"([^"]+)"/g) || [];
      const title   = matches[0] ? matches[0].replace(/"/g, '') : rest;
      const desc    = matches[1] ? matches[1].replace(/"/g, '') : '';
      if (!title) { await sendTelegramTo(chatId, 'Usage: /newtask &lt;projectId&gt; "title" ["description"]'); return; }
      const task = await apiCall('POST', '/api/tasks', { project_id: projectId, title, description: desc });
      await sendTelegramTo(chatId, [
        `✅ <b>Task created</b>: ${escapeHtml(task.title || title)}`,
        `ID: <code>${(task.id || '').slice(0, 8)}</code>`,
        `Status: ${task.status || 'pending'} (auto-assign will pick it up)`,
      ].join('\n'));

    } else if (cmd === '/execute') {
      const taskId = parts[1];
      if (!taskId) { await sendTelegramTo(chatId, 'Usage: /execute &lt;taskId&gt;'); return; }
      await sendTelegramTo(chatId, `⚙️ Executing task <code>${taskId.slice(0, 8)}</code>...`);
      const result = await apiCall('POST', `/api/tasks/${taskId}/execute`, {});
      const snippet = result.result
        ? (result.result.length > 200 ? result.result.slice(0, 200) + '…' : result.result)
        : 'Done';
      await sendTelegramTo(chatId, [
        `✅ <b>Task executed</b>`,
        `📝 ${escapeHtml(snippet)}`,
      ].join('\n'));

    } else {
      await sendTelegramTo(chatId, `Unknown command: ${escapeHtml(cmd)}\nSend /help for the list.`);
    }
  } catch (err) {
    console.error(`[notifier] Command ${cmd} error:`, err.message);
    await sendTelegramTo(chatId, `❌ Error: ${escapeHtml(err.message)}`);
  }
}

async function sendTelegramTo(chatId, text) {
  try {
    const res = await httpRequest('POST', `https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      chat_id: chatId, text, parse_mode: 'HTML',
    });
    if (res.statusCode !== 200) {
      console.error(`[notifier] Telegram sendMessage error ${res.statusCode}: ${res.body}`);
    }
  } catch (err) {
    console.error(`[notifier] sendTelegramTo failed: ${err.message}`);
  }
}

run().catch((err) => {
  console.error('[notifier] Fatal:', err.message);
  process.exit(1);
});
