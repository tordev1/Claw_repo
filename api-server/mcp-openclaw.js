#!/usr/bin/env node
/**
 * mcp-openclaw.js — MCP server for OpenClaw / Project Claw
 *
 * Two modes:
 *   stdio (default) — for local Claude Code (runs as subprocess)
 *   http            — for remote Claude Code on LAN (SSE on port 3002)
 *
 * Usage:
 *   node mcp-openclaw.js               ← stdio mode (you)
 *   MCP_MODE=http node mcp-openclaw.js ← HTTP mode (coworker connects remotely)
 *
 * Env vars:
 *   MCP_API_URL    — OpenClaw API (default: http://localhost:3001)
 *   MCP_LOGIN      — OpenClaw login (default: Scorpion)
 *   MCP_PASSWORD   — password
 *   MCP_MODE       — stdio | http (default: stdio)
 *   MCP_HTTP_PORT  — port for http mode (default: 3002)
 */

require('dotenv').config();
const { McpServer }          = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { SSEServerTransport }   = require('@modelcontextprotocol/sdk/server/sse.js');
const { z } = require('zod');
const http  = require('http');
const https = require('https');

const API_URL       = process.env.MCP_API_URL   || process.env.API_URL || 'http://localhost:3001';
const LOGIN         = process.env.MCP_LOGIN     || 'Scorpion';
const PASSWORD      = process.env.MCP_PASSWORD  || 'Scorpion123';
const MCP_MODE      = process.env.MCP_MODE      || 'stdio';
const MCP_HTTP_PORT = parseInt(process.env.MCP_HTTP_PORT || '3002');

let _token = null;

// ── HTTP helper ──────────────────────────────────────────────────────────────
function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_URL);
    const lib  = url.protocol === 'https:' ? https : http;
    const data = body ? JSON.stringify(body) : null;
    const req  = lib.request({
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(data  ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        ...(token ? { 'Authorization': `Bearer ${token}` }       : {})
      }
    }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function getToken() {
  if (_token) return _token;
  const res = await request('POST', '/api/auth/login', { login: LOGIN, password: PASSWORD });
  if (res.status !== 200) throw new Error(`Auth failed: ${JSON.stringify(res.body)}`);
  _token = res.body.session?.token || res.body.token;
  return _token;
}

async function api(method, path, body) {
  const token = await getToken();
  const res   = await request(method, path, body, token);
  if (res.status === 401) { _token = null; return api(method, path, body); }
  return res;
}

// ── Tool registration (works on any McpServer instance) ──────────────────────
function registerTools(srv) {

  srv.tool('list_channels',
    'List all channels in OpenClaw',
    {},
    async () => {
      const res      = await api('GET', '/api/channels');
      const channels = Array.isArray(res.body) ? res.body : (res.body.channels || []);
      const text     = channels.map(c =>
        `[${c.id}] #${c.name || c.id} (${c.type || 'channel'})${c.project_name ? ` — ${c.project_name}` : ''}`
      ).join('\n') || 'No channels.';
      return { content: [{ type: 'text', text }] };
    }
  );

  srv.tool('read_channel',
    'Read recent messages from a channel',
    { channel_id: z.string(), limit: z.number().optional() },
    async ({ channel_id, limit = 30 }) => {
      const res  = await api('GET', `/api/channels/${channel_id}/messages?limit=${limit}`);
      const msgs = Array.isArray(res.body) ? res.body : (res.body.messages || []);
      if (!msgs.length) return { content: [{ type: 'text', text: 'No messages.' }] };
      const text = msgs.map(m => {
        const who  = m.sender_name || m.user_name || m.agent_name || 'unknown';
        const icon = m.sender_type === 'agent' ? '🤖' : '👤';
        const time = m.created_at ? new Date(m.created_at).toLocaleTimeString() : '';
        return `[${time}] ${icon} ${who}: ${m.content}`;
      }).join('\n');
      return { content: [{ type: 'text', text }] };
    }
  );

  srv.tool('send_message',
    'Post a message to a channel — this is how two Claude Code instances communicate',
    { channel_id: z.string(), content: z.string() },
    async ({ channel_id, content }) => {
      const res = await api('POST', `/api/channels/${channel_id}/messages`, { content });
      if (res.status === 200 || res.status === 201)
        return { content: [{ type: 'text', text: `✓ Sent to #${channel_id}` }] };
      return { content: [{ type: 'text', text: `Error ${res.status}: ${JSON.stringify(res.body)}` }] };
    }
  );

  srv.tool('list_agents',
    'List all agents and their status',
    { status: z.string().optional() },
    async ({ status }) => {
      const res    = await api('GET', '/api/agents');
      let agents   = Array.isArray(res.body) ? res.body : (res.body.agents || []);
      if (status) agents = agents.filter(a => a.status === status);
      if (!agents.length) return { content: [{ type: 'text', text: 'No agents.' }] };
      const text   = agents.map(a =>
        `[${a.id.slice(0,8)}] @${a.handle} (${a.name}) — ${a.status} | ${a.type || 'worker'} | ${a.current_model || 'default'}`
      ).join('\n');
      return { content: [{ type: 'text', text }] };
    }
  );

  srv.tool('list_projects',
    'List all projects',
    {},
    async () => {
      const res      = await api('GET', '/api/projects');
      const projects = Array.isArray(res.body) ? res.body : (res.body.projects || []);
      if (!projects.length) return { content: [{ type: 'text', text: 'No projects.' }] };
      const text     = projects.map(p =>
        `[${p.id.slice(0,8)}] "${p.name}" — ${p.status} | tasks: ${p.task_count || 0}`
      ).join('\n');
      return { content: [{ type: 'text', text }] };
    }
  );

  srv.tool('list_tasks',
    'List tasks, optionally filtered by project or status',
    { project_id: z.string().optional(), status: z.string().optional() },
    async ({ project_id, status }) => {
      const params = new URLSearchParams();
      if (project_id) params.set('project_id', project_id);
      if (status)     params.set('status', status);
      const res   = await api('GET', `/api/tasks?${params}`);
      const tasks = Array.isArray(res.body) ? res.body : (res.body.tasks || []);
      if (!tasks.length) return { content: [{ type: 'text', text: 'No tasks.' }] };
      const text  = tasks.map(t =>
        `[${t.id.slice(0,8)}] "${t.title}" — ${t.status} | agent: ${t.agent_name || 'unassigned'}`
      ).join('\n');
      return { content: [{ type: 'text', text }] };
    }
  );

  srv.tool('create_task',
    'Create a new task in a project',
    {
      project_id:  z.string(),
      title:       z.string(),
      description: z.string().optional(),
      agent_id:    z.string().optional(),
      priority:    z.enum(['low', 'medium', 'high']).optional()
    },
    async ({ project_id, title, description, agent_id, priority }) => {
      const res = await api('POST', '/api/tasks', { project_id, title, description, agent_id, priority: priority || 'medium' });
      if (res.status === 200 || res.status === 201) {
        const t = res.body.task || res.body;
        return { content: [{ type: 'text', text: `✓ Task created: [${t.id?.slice(0,8)}] "${t.title || title}"` }] };
      }
      return { content: [{ type: 'text', text: `Error ${res.status}: ${JSON.stringify(res.body)}` }] };
    }
  );

  srv.tool('get_task',
    'Get full details and result of a task',
    { task_id: z.string() },
    async ({ task_id }) => {
      const res = await api('GET', `/api/tasks/${task_id}`);
      if (res.status !== 200) return { content: [{ type: 'text', text: `Error: ${res.status}` }] };
      const t   = res.body.task || res.body;
      const lines = [
        `Title:    ${t.title}`,
        `Status:   ${t.status}`,
        `Agent:    ${t.agent_name || 'unassigned'}`,
        `Project:  ${t.project_name || t.project_id}`,
        `Desc:     ${t.description || '-'}`,
        t.result ? `\nResult:\n${t.result}` : ''
      ].filter(Boolean);
      return { content: [{ type: 'text', text: lines.join('\n') }] };
    }
  );

  srv.tool('execute_task',
    'Execute a task via AI (starts + runs the LLM)',
    { task_id: z.string() },
    async ({ task_id }) => {
      await api('POST', `/api/tasks/${task_id}/start`);
      const res = await api('POST', `/api/tasks/${task_id}/execute`);
      if (res.status === 200) {
        const r = res.body;
        return { content: [{ type: 'text', text: `✓ Done\nModel: ${r.model || '-'} | Tokens: ${r.tokens || '-'} | Cost: $${r.cost || 0}\n\n${r.result || ''}` }] };
      }
      return { content: [{ type: 'text', text: `Error ${res.status}: ${JSON.stringify(res.body)}` }] };
    }
  );

  srv.tool('get_activity',
    'Get recent platform activity',
    { limit: z.number().optional() },
    async ({ limit = 20 }) => {
      const res   = await api('GET', `/api/activity?limit=${limit}`);
      const items = res.body.activities || res.body || [];
      if (!items.length) return { content: [{ type: 'text', text: 'No activity.' }] };
      const text  = items.map(a => {
        const time = a.created_at ? new Date(a.created_at).toLocaleString() : '';
        return `[${time}] ${a.event_type}:${a.action} — ${a.entity_title || ''} ${a.agent_name ? `(@${a.agent_name})` : ''}`;
      }).join('\n');
      return { content: [{ type: 'text', text }] };
    }
  );

  srv.tool('create_project',
    'Create a new project',
    { name: z.string(), description: z.string().optional() },
    async ({ name, description }) => {
      const res = await api('POST', '/api/projects', { name, description, status: 'active' });
      if (res.status === 200 || res.status === 201) {
        const p = res.body.project || res.body;
        return { content: [{ type: 'text', text: `✓ Project: [${p.id?.slice(0,8)}] "${p.name || name}"` }] };
      }
      return { content: [{ type: 'text', text: `Error ${res.status}: ${JSON.stringify(res.body)}` }] };
    }
  );
}

// ── Start ────────────────────────────────────────────────────────────────────
async function main() {
  if (MCP_MODE === 'http') {
    // HTTP/SSE mode — coworker connects to http://192.168.1.80:3002/sse
    const express = require('express');
    const app      = express();
    app.use(express.json());

    const sessions = {}; // sessionId → transport

    app.get('/sse', async (req, res) => {
      const srv       = new McpServer({ name: 'openclaw', version: '1.0.0' });
      const transport = new SSEServerTransport('/messages', res);
      sessions[transport.sessionId] = transport;
      res.on('close', () => delete sessions[transport.sessionId]);
      registerTools(srv);
      await srv.connect(transport);
    });

    app.post('/messages', async (req, res) => {
      const t = sessions[req.query.sessionId];
      if (t) await t.handlePostMessage(req, res);
      else   res.status(400).json({ error: 'session not found' });
    });

    app.get('/health', (_, res) => res.json({ ok: true, api: API_URL, mode: 'http' }));

    app.listen(MCP_HTTP_PORT, '0.0.0.0', () => {
      console.log(`[openclaw-mcp] HTTP/SSE running on :${MCP_HTTP_PORT}`);
      console.log(`[openclaw-mcp] Coworker SSE URL: http://192.168.1.80:${MCP_HTTP_PORT}/sse`);
    });

  } else {
    // Stdio mode — default, Claude Code spawns this as subprocess
    const srv       = new McpServer({ name: 'openclaw', version: '1.0.0' });
    const transport = new StdioServerTransport();
    registerTools(srv);
    await srv.connect(transport);
    process.stderr.write(`[openclaw-mcp] stdio connected → ${API_URL} as ${LOGIN}\n`);
  }
}

main().catch(e => {
  process.stderr.write(`[openclaw-mcp] Fatal: ${e.message}\n`);
  process.exit(1);
});
