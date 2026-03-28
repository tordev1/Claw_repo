#!/usr/bin/env node
/**
 * mcp-openclaw.js — MCP server for OpenClaw / Project Claw
 *
 * Exposes OpenClaw as MCP tools so any Claude Code instance on the LAN
 * can read channels, post messages, create/query tasks, and see agents.
 *
 * Usage (stdio transport — Claude Code default):
 *   node mcp-openclaw.js
 *
 * Env vars (or .env in api-server/):
 *   MCP_API_URL   — OpenClaw base URL (default: http://localhost:3001)
 *   MCP_LOGIN     — OpenClaw login (default: Scorpion)
 *   MCP_PASSWORD  — OpenClaw password (default: Scorpion123)
 */

require('dotenv').config();
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');
const http = require('http');
const https = require('https');

const API_URL  = process.env.MCP_API_URL  || process.env.API_URL || 'http://localhost:3001';
const LOGIN    = process.env.MCP_LOGIN    || 'Scorpion';
const PASSWORD = process.env.MCP_PASSWORD || 'Scorpion123';

let _token = null;

// ── HTTP helper ──────────────────────────────────────────────────────────────
function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_URL);
    const lib = url.protocol === 'https:' ? https : http;
    const data = body ? JSON.stringify(body) : null;

    const req = lib.request({
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
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

// ── Auth ─────────────────────────────────────────────────────────────────────
async function getToken() {
  if (_token) return _token;
  const res = await request('POST', '/api/auth/login', { login: LOGIN, password: PASSWORD });
  if (res.status !== 200) throw new Error(`Auth failed: ${JSON.stringify(res.body)}`);
  _token = res.body.token;
  return _token;
}

async function api(method, path, body) {
  const token = await getToken();
  const res = await request(method, path, body, token);
  if (res.status === 401) {
    _token = null; // token expired — retry once
    const token2 = await getToken();
    const res2 = await request(method, path, body, token2);
    return res2;
  }
  return res;
}

// ── MCP Server ───────────────────────────────────────────────────────────────
const server = new McpServer({
  name: 'openclaw',
  version: '1.0.0',
});

// ── TOOL: list_channels ──────────────────────────────────────────────────────
server.tool(
  'list_channels',
  'List all available channels in OpenClaw (general, project channels, DMs)',
  {},
  async () => {
    const res = await api('GET', '/api/channels');
    const channels = Array.isArray(res.body) ? res.body : (res.body.channels || []);
    const text = channels.map(c =>
      `[${c.id}] #${c.name || c.id} (${c.type || 'channel'})${c.project_name ? ` — project: ${c.project_name}` : ''}`
    ).join('\n') || 'No channels found.';
    return { content: [{ type: 'text', text }] };
  }
);

// ── TOOL: read_channel ───────────────────────────────────────────────────────
server.tool(
  'read_channel',
  'Read recent messages from a channel. Use list_channels first to get channel IDs.',
  { channel_id: z.string().describe('Channel ID'), limit: z.number().optional().describe('Number of messages (default 30)') },
  async ({ channel_id, limit = 30 }) => {
    const res = await api('GET', `/api/channels/${channel_id}/messages?limit=${limit}`);
    const msgs = Array.isArray(res.body) ? res.body : (res.body.messages || []);
    if (!msgs.length) return { content: [{ type: 'text', text: 'No messages in this channel.' }] };
    const text = msgs.map(m => {
      const who  = m.sender_name || m.user_name || m.agent_name || 'unknown';
      const type = m.sender_type === 'agent' ? '🤖' : '👤';
      const time = m.created_at ? new Date(m.created_at).toLocaleTimeString() : '';
      return `[${time}] ${type} ${who}: ${m.content}`;
    }).join('\n');
    return { content: [{ type: 'text', text }] };
  }
);

// ── TOOL: send_message ───────────────────────────────────────────────────────
server.tool(
  'send_message',
  'Post a message to a channel. This is how two Claude Code instances communicate — both can read the same channel.',
  { channel_id: z.string().describe('Channel ID (use list_channels to find it)'), content: z.string().describe('Message text to send') },
  async ({ channel_id, content }) => {
    const res = await api('POST', `/api/channels/${channel_id}/messages`, { content });
    if (res.status === 200 || res.status === 201) {
      return { content: [{ type: 'text', text: `✓ Message sent to channel ${channel_id}` }] };
    }
    return { content: [{ type: 'text', text: `Error ${res.status}: ${JSON.stringify(res.body)}` }] };
  }
);

// ── TOOL: list_agents ────────────────────────────────────────────────────────
server.tool(
  'list_agents',
  'List all registered agents and their current status (online/offline/pending)',
  { status: z.string().optional().describe('Filter by status: online, offline, pending') },
  async ({ status }) => {
    const res = await api('GET', '/api/agents');
    let agents = Array.isArray(res.body) ? res.body : (res.body.agents || []);
    if (status) agents = agents.filter(a => a.status === status);
    if (!agents.length) return { content: [{ type: 'text', text: 'No agents found.' }] };
    const text = agents.map(a =>
      `[${a.id.slice(0,8)}] @${a.handle} (${a.name}) — ${a.status} | type: ${a.type || 'worker'} | model: ${a.current_model || 'default'}`
    ).join('\n');
    return { content: [{ type: 'text', text }] };
  }
);

// ── TOOL: list_projects ──────────────────────────────────────────────────────
server.tool(
  'list_projects',
  'List all projects in OpenClaw with their status and task counts',
  {},
  async () => {
    const res = await api('GET', '/api/projects');
    const projects = Array.isArray(res.body) ? res.body : (res.body.projects || []);
    if (!projects.length) return { content: [{ type: 'text', text: 'No projects found.' }] };
    const text = projects.map(p =>
      `[${p.id.slice(0,8)}] "${p.name}" — status: ${p.status} | tasks: ${p.task_count || 0}`
    ).join('\n');
    return { content: [{ type: 'text', text }] };
  }
);

// ── TOOL: list_tasks ─────────────────────────────────────────────────────────
server.tool(
  'list_tasks',
  'List tasks — optionally filtered by project or status',
  {
    project_id: z.string().optional().describe('Filter by project ID'),
    status: z.string().optional().describe('Filter by status: pending, running, completed, failed')
  },
  async ({ project_id, status }) => {
    const params = new URLSearchParams();
    if (project_id) params.set('project_id', project_id);
    if (status) params.set('status', status);
    const res = await api('GET', `/api/tasks?${params}`);
    const tasks = Array.isArray(res.body) ? res.body : (res.body.tasks || []);
    if (!tasks.length) return { content: [{ type: 'text', text: 'No tasks found.' }] };
    const text = tasks.map(t =>
      `[${t.id.slice(0,8)}] "${t.title}" — ${t.status} | agent: ${t.agent_name || 'unassigned'} | project: ${t.project_name || t.project_id || '-'}`
    ).join('\n');
    return { content: [{ type: 'text', text }] };
  }
);

// ── TOOL: create_task ────────────────────────────────────────────────────────
server.tool(
  'create_task',
  'Create a new task in a project and optionally assign it to an agent',
  {
    project_id: z.string().describe('Project ID to add the task to'),
    title: z.string().describe('Task title'),
    description: z.string().optional().describe('Detailed task description'),
    agent_id: z.string().optional().describe('Agent ID to assign (use list_agents to find IDs)'),
    priority: z.enum(['low', 'medium', 'high']).optional().describe('Task priority')
  },
  async ({ project_id, title, description, agent_id, priority }) => {
    const body = { project_id, title, description, agent_id, priority: priority || 'medium' };
    const res = await api('POST', '/api/tasks', body);
    if (res.status === 200 || res.status === 201) {
      const t = res.body.task || res.body;
      return { content: [{ type: 'text', text: `✓ Task created: [${t.id?.slice(0,8)}] "${t.title || title}"` }] };
    }
    return { content: [{ type: 'text', text: `Error ${res.status}: ${JSON.stringify(res.body)}` }] };
  }
);

// ── TOOL: get_task ───────────────────────────────────────────────────────────
server.tool(
  'get_task',
  'Get full details of a specific task including its result/output',
  { task_id: z.string().describe('Task ID') },
  async ({ task_id }) => {
    const res = await api('GET', `/api/tasks/${task_id}`);
    if (res.status !== 200) return { content: [{ type: 'text', text: `Error: ${res.status}` }] };
    const t = res.body.task || res.body;
    const lines = [
      `Title:       ${t.title}`,
      `Status:      ${t.status}`,
      `Priority:    ${t.priority || '-'}`,
      `Agent:       ${t.agent_name || 'unassigned'}`,
      `Project:     ${t.project_name || t.project_id}`,
      `Created:     ${t.created_at}`,
      `Description: ${t.description || '-'}`,
      t.result ? `\nResult:\n${t.result}` : ''
    ].filter(Boolean);
    return { content: [{ type: 'text', text: lines.join('\n') }] };
  }
);

// ── TOOL: execute_task ───────────────────────────────────────────────────────
server.tool(
  'execute_task',
  'Execute a task via AI (runs the LLM on the task description). Task must be in running status.',
  { task_id: z.string().describe('Task ID to execute') },
  async ({ task_id }) => {
    // First start the task
    await api('POST', `/api/tasks/${task_id}/start`);
    const res = await api('POST', `/api/tasks/${task_id}/execute`);
    if (res.status === 200) {
      const r = res.body;
      return { content: [{ type: 'text', text: `✓ Task executed\nModel: ${r.model || '-'}\nTokens: ${r.tokens || '-'}\nCost: $${r.cost || 0}\n\nResult:\n${r.result || '-'}` }] };
    }
    return { content: [{ type: 'text', text: `Error ${res.status}: ${JSON.stringify(res.body)}` }] };
  }
);

// ── TOOL: get_activity ───────────────────────────────────────────────────────
server.tool(
  'get_activity',
  'Get recent platform activity — tasks completed, agents joined, projects created',
  { limit: z.number().optional().describe('Number of events (default 20)') },
  async ({ limit = 20 }) => {
    const res = await api('GET', `/api/activity?limit=${limit}`);
    const items = res.body.activities || res.body || [];
    if (!items.length) return { content: [{ type: 'text', text: 'No activity found.' }] };
    const text = items.map(a => {
      const time = a.created_at ? new Date(a.created_at).toLocaleString() : '';
      return `[${time}] ${a.event_type}:${a.action} — ${a.entity_title || a.entity_id || ''} ${a.agent_name ? `(@${a.agent_name})` : ''}`;
    }).join('\n');
    return { content: [{ type: 'text', text }] };
  }
);

// ── TOOL: create_project ─────────────────────────────────────────────────────
server.tool(
  'create_project',
  'Create a new project in OpenClaw',
  {
    name: z.string().describe('Project name'),
    description: z.string().optional().describe('Project description'),
    status: z.enum(['active', 'planning', 'on_hold', 'completed']).optional()
  },
  async ({ name, description, status = 'active' }) => {
    const res = await api('POST', '/api/projects', { name, description, status });
    if (res.status === 200 || res.status === 201) {
      const p = res.body.project || res.body;
      return { content: [{ type: 'text', text: `✓ Project created: [${p.id?.slice(0,8)}] "${p.name || name}"` }] };
    }
    return { content: [{ type: 'text', text: `Error ${res.status}: ${JSON.stringify(res.body)}` }] };
  }
);

// ── Start ────────────────────────────────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Log to stderr so it doesn't pollute stdio MCP protocol
  process.stderr.write(`[openclaw-mcp] Connected to ${API_URL} as ${LOGIN}\n`);
}

main().catch(e => {
  process.stderr.write(`[openclaw-mcp] Fatal: ${e.message}\n`);
  process.exit(1);
});
