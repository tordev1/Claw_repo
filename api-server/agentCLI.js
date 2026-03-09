#!/usr/bin/env node
/**
 * agent-cli.js — PROJECT-CLAW test agent
 *
 * Usage:
 *   node agent-cli.js --name "Sigma" --handle sigma
 *   node agent-cli.js --name "Sigma" --handle sigma --login Scorpion --password admin123
 */

const http = require('http');
const https = require('https');
const net = require('net');
const tls = require('tls');
const readline = require('readline');
const { URL } = require('url');

const BASE = process.env.API_URL || 'http://localhost:3001';
const WS_BASE = BASE.replace(/^http/, 'ws');

const args = process.argv.slice(2);
const get = (f, d) => { const i = args.indexOf(f); return i !== -1 ? args[i + 1] : d; };

const AGENT_NAME = get('--name', 'TestAgent');
const AGENT_HANDLE = get('--handle', 'testagent');
const AGENT_SKILLS = get('--skills', 'general,testing').split(',').map(s => s.trim());

const C = { G: '\x1b[32m', Y: '\x1b[33m', C: '\x1b[36m', R: '\x1b[31m', B: '\x1b[1m', X: '\x1b[0m', A: '\x1b[33m' };
const log = (tag, msg, c = C.X) => console.log(`${c}[${new Date().toLocaleTimeString()}] [${tag}]${C.X} ${msg}`);
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── HTTP ─────────────────────────────────────────────────────────────────────
function req(method, path, body, token) {
    return new Promise((resolve, reject) => {
        const u = new URL(BASE + path);
        const lib = u.protocol === 'https:' ? https : http;
        const data = body ? JSON.stringify(body) : null;
        const r = lib.request({
            hostname: u.hostname, port: u.port || 80, path: u.pathname + u.search, method,
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
            },
        }, res => {
            let raw = '';
            res.on('data', d => raw += d);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
                catch { resolve({ status: res.statusCode, body: raw }); }
            });
        });
        r.on('error', reject);
        if (data) r.write(data);
        r.end();
    });
}

// ── Prompt ───────────────────────────────────────────────────────────────────
function prompt(question, secret = false) {
    return new Promise(resolve => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        if (secret) {
            process.stdout.write(question);
            process.stdin.setRawMode?.(true);
            let pw = '';
            process.stdin.resume();
            process.stdin.setEncoding('utf8');
            const onData = ch => {
                if (ch === '\n' || ch === '\r' || ch === '\u0003') {
                    process.stdin.setRawMode?.(false);
                    process.stdin.pause();
                    process.stdin.removeListener('data', onData);
                    console.log('');
                    rl.close();
                    resolve(pw);
                } else if (ch === '\u007f') {
                    pw = pw.slice(0, -1);
                } else {
                    pw += ch;
                    process.stdout.write('*');
                }
            };
            process.stdin.on('data', onData);
        } else {
            rl.question(question, ans => { rl.close(); resolve(ans.trim()); });
        }
    });
}

// ── WebSocket ─────────────────────────────────────────────────────────────────
function wsConnect(agentId, userToken, onMsg) {
    const u = new URL(`${BASE}/ws?token=${encodeURIComponent(userToken)}`);
    const lib = u.protocol === 'https:' ? https : http;
    const port = parseInt(u.port) || (u.protocol === 'https:' ? 443 : 80);
    const key = Buffer.from(Array.from({length: 16}, () => Math.floor(Math.random() * 256))).toString('base64');

    const httpReq = lib.request({
        hostname: u.hostname,
        port,
        path: u.pathname + u.search,
        headers: {
            Connection: 'Upgrade',
            Upgrade: 'websocket',
            'Sec-WebSocket-Key': key,
            'Sec-WebSocket-Version': '13',
        }
    });
    httpReq.end();

    httpReq.on('upgrade', (res, sock, head) => {
        log('WS', 'Connected ✓', C.G);
        let buf = head && head.length ? head : Buffer.alloc(0);

        sock.on('data', chunk => {
            buf = Buffer.concat([buf, chunk]);
            while (buf.length >= 2) {
                const opcode = buf[0] & 0x0f;
                let len = buf[1] & 0x7f, off = 2;
                if (len === 126) { len = buf.readUInt16BE(2); off = 4; }
                if (buf.length < off + len) break;
                const payload = buf.slice(off, off + len);
                buf = buf.slice(off + len);
                if (opcode === 1) { try { onMsg(JSON.parse(payload.toString())); } catch { } }
                if (opcode === 9) wsSend(sock, '', 10);
            }
        });

        sock.on('error', e => log('WS', e.message, C.R));

        const keepalive = setInterval(() => { if (sock.writable) wsSend(sock, '', 9); }, 25000);

        sock.on('close', () => {
            clearInterval(keepalive);
            log('WS', 'Disconnected — reconnecting in 5s...', C.Y);
            setTimeout(() => wsConnect(agentId, userToken, onMsg), 5000);
        });
    });

    httpReq.on('response', res => {
        let body = '';
        res.on('data', d => body += d);
        res.on('end', () => {
            log('WS', `Upgrade rejected: HTTP ${res.statusCode} — ${body.substring(0, 150)}`, C.R);
        });
        res.resume();
        setTimeout(() => wsConnect(agentId, userToken, onMsg), 5000);
    });

    httpReq.on('error', e => {
        log('WS', e.message, C.R);
        setTimeout(() => wsConnect(agentId, userToken, onMsg), 5000);
    });
}

function wsSend(sock, data, opcode = 1) {
    const p = Buffer.from(typeof data === 'string' ? data : '');
    const mask = Buffer.allocUnsafe(4);
    mask.writeUInt32BE((Math.random() * 0xFFFFFFFF) >>> 0, 0);
    const masked = Buffer.allocUnsafe(p.length);
    for (let i = 0; i < p.length; i++) masked[i] = p[i] ^ mask[i % 4];
    const header = p.length < 126
        ? Buffer.from([0x80 | opcode, 0x80 | p.length])
        : Buffer.from([0x80 | opcode, 0x80 | 126, p.length >> 8, p.length & 0xff]);
    sock.write(Buffer.concat([header, mask, masked]));
}

// ── Chat ──────────────────────────────────────────────────────────────────────
async function sendMessage(channelId, content, userToken, agentId) {
    try {
        const body = { content };
        if (agentId) body.agent_id = agentId;
        const r = await req('POST', `/api/channels/${channelId}/messages`, body, userToken);
        if (r.status !== 200 && r.status !== 201) {
            log('CHAT', `Send failed (${r.status}): ${JSON.stringify(r.body)}`, C.R);
        }
    } catch (e) { log('CHAT', `Send error: ${e.message}`, C.R); }
}

function isMentioned(content) {
    if (!content) return false;
    const lower = content.toLowerCase();
    return lower.includes(`@${AGENT_HANDLE.toLowerCase()}`) ||
           lower.includes(`@${AGENT_NAME.toLowerCase()}`);
}

// ── Task handling ─────────────────────────────────────────────────────────────
async function handleTask(data, agentId, userToken) {
    const id = data.task_id || data.id;
    const title = data.task_title || data.title || id;
    log('TASK', `📋 Assigned: "${title}"`, C.A);
    await sleep(1000);

    const acc = await req('POST', `/api/tasks/${id}/accept`, {}, userToken);
    if (acc.status === 200) log('TASK', '✓ Accepted', C.G);
    else { log('TASK', `Accept failed (${acc.status}): ${JSON.stringify(acc.body)}`, C.R); return; }

    await sleep(500);
    await req('POST', `/api/tasks/${id}/start`, {}, userToken);
    log('TASK', '✓ Started — simulating 5s of work...', C.C);
    await sleep(5000);

    const done = await req('POST', `/api/tasks/${id}/complete`, {
        result: `"${title}" completed by agent ${AGENT_NAME}.`
    }, userToken);
    if (done.status === 200) log('TASK', `✅ Completed: "${title}"`, C.G);
    else log('TASK', `Complete failed: ${JSON.stringify(done.body)}`, C.R);
}

// ── Notification poll ─────────────────────────────────────────────────────────
const seenNotifications = new Set();

async function pollNotifications(agentId, userToken) {
    try {
        const r = await req('GET', `/api/agents/${agentId}/notifications`, null, userToken);
        if (r.status === 200) {
            for (const n of (r.body.notifications || []).filter(n => !n.is_read)) {
                if (seenNotifications.has(n.id)) continue;
                seenNotifications.add(n.id);
                log('NOTIF', `🔔 ${n.title}: ${n.content}`, C.Y);
                const res = await req('POST', `/api/agents/${agentId}/notifications/${n.id}/read`, {}, userToken);
                if (res.status !== 200) log('NOTIF', `Mark-read failed (${res.status})`, C.R);
            }
        }
    } catch { }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
    console.log(`\n${C.B}╔══════════════════════════════════════╗`);
    console.log(`║    PROJECT-CLAW  AGENT  CLI  v3      ║`);
    console.log(`╚══════════════════════════════════════╝${C.X}\n`);

    // ── Step 1: Register agent (no admin credentials needed) ─────────────────
    log('INIT', `Registering agent "${AGENT_NAME}" @${AGENT_HANDLE}...`, C.C);
    const regRes = await req('POST', '/api/agents/register', {
        name: AGENT_NAME, handle: AGENT_HANDLE,
        description: `CLI agent — ${AGENT_NAME}`,
        skills: AGENT_SKILLS, preferred_model: 'gpt-4o', experience_level: 'expert',
    });

    let agentId, userToken;
    if (regRes.status === 201 || regRes.status === 200) {
        agentId = regRes.body.id || regRes.body.agent?.id;
        userToken = regRes.body.token;
        log('INIT', `✓ Registered. ID: ${agentId}`, C.G);
    } else if (regRes.status === 409) {
        log('INIT', `Handle @${AGENT_HANDLE} already exists — run node reset-db.js first.`, C.R);
        process.exit(1);
    } else {
        log('INIT', `Registration failed (${regRes.status}): ${JSON.stringify(regRes.body)}`, C.R);
        process.exit(1);
    }

    // ── Step 2: Wait for approval ─────────────────────────────────────────────
    log('INIT', ``, C.X);
    log('INIT', `${C.B}Waiting for admin approval...${C.X}`, C.Y);
    log('INIT', `Ask admin to approve @${AGENT_HANDLE} at the /admin panel`, C.X);

    let approved = false;
    while (!approved) {
        await sleep(3000);
        const check = await req('GET', `/api/agents/${agentId}`, null, userToken);
        const a = check.body?.agent || check.body;
        approved = a?.is_approved === true || a?.is_approved === 1;
        process.stdout.write('.');
    }
    console.log('');
    log('INIT', '✅ Agent approved!', C.G);

    // ── Step 3: Go online ──────────────────────────────────────────────────────
    const onlineRes = await req('POST', `/api/agents/${agentId}/status`, { status: 'online' }, userToken);
    if (onlineRes.status === 200) log('INIT', '✅ Status set to ONLINE', C.G);
    else log('INIT', `Status update: ${JSON.stringify(onlineRes.body)}`, C.Y);

    // ── Step 4: WebSocket ──────────────────────────────────────────────────────
    const activeTasks = new Set();
    const repliedMessages = new Set();       // dedupe by message ID
    const channelCooldown = new Map();       // channel → last-reply timestamp

    wsConnect(agentId, userToken, async msg => {
        const ev = msg.event || msg.type;
        const data = msg.data || msg;

        if (ev === 'task:assigned' || ev === 'agent:task_assigned') {
            // Accept tasks assigned to this specific agent
            const tid = data?.task_id || data?.id;
            if (tid && data?.agent_id === agentId && !activeTasks.has(tid)) {
                activeTasks.add(tid);
                handleTask(data, agentId, userToken).finally(() => activeTasks.delete(tid));
            }
        }

        if (ev === 'notification:new' || ev === 'agent:notification') {
            log('NOTIF', `🔔 ${data?.title || ev}: ${data?.content || data?.message || ''}`, C.Y);
        }

        if (ev === 'chat:message' || ev === 'message:new') {
            const isMine = data?.sender_id === agentId || data?.sender_type === 'agent' && data?.sender_id === agentId;
            const msgId = data?.id || data?.message_id;

            // Skip own messages and already-handled messages
            if (isMine || (msgId && repliedMessages.has(msgId))) return;

            if (data?.content) {
                const sender = data?.sender_name || '?';
                const channelId = data?.channel_id;
                log('MSG', `💬 [#${data?.channel_name || channelId}] ${sender}: ${data.content}`, C.C);

                // Track message IDs to prevent duplicate processing
                if (msgId) repliedMessages.add(msgId);
                if (repliedMessages.size > 500) repliedMessages.clear();
            }
        }

        if (ev === 'agent:rejected') {
            if (!data?.id || data?.id === agentId) {
                log('INIT', `❌ Registration rejected: ${data?.reason || 'No reason given'}`, C.R);
                process.exit(1);
            }
        }

        if (ev === 'project:created') {
            const name = data?.name || data?.project_name || data?.id;
            log('PROJECT', `🆕 New project created: "${name}"`, C.C);
        }

        if (ev === 'agent:assigned_to_project' || ev === 'agent:project_assigned') {
            if (data?.agent_id === agentId) {
                const projectName = data?.project_name || data?.project_id;
                log('PROJECT', `✅ Assigned to project: "${projectName}"`, C.G);
            }
        }

        if (ev === 'agent:removed_from_project' || ev === 'agent:project_removed') {
            if (data?.agent_id === agentId) {
                const projectName = data?.project_name || data?.project_id;
                log('PROJECT', `⚠ Removed from project: "${projectName}"`, C.Y);
            }
        }
    });

    // Notification fallback poll every 15s
    setInterval(() => pollNotifications(agentId, userToken), 15000);

    console.log(`\n${C.B}${C.G}╔══════════════════════════════════════╗`);
    console.log(`║  ${AGENT_NAME} is ONLINE  ║`);
    console.log(`╚══════════════════════════════════════╝${C.X}`);
    log('AGENT', `Assign tasks from Admin panel or Tasks page.`, C.C);
    log('AGENT', `Ctrl+C to disconnect.\n`, C.Y);
}

main().catch(e => { console.error(`\n${C.R}Fatal:${C.X}`, e.message); process.exit(1); });