/**
 * seedDemo.js — creates demo agents + project for HQ testing
 * Usage: node seedDemo.js
 */

const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, 'data', 'project-claw.db');
const db = new Database(DB_PATH);

const now = new Date().toISOString();
const uid = () => crypto.randomUUID();

// ── create project first (agents need project_id) ─────────────────────────────

console.log('\n📁 Seeding demo project...\n');

let projectId;
const existingProject = db.prepare("SELECT id FROM projects WHERE name = 'OpenClaw Platform'").get();
if (existingProject) {
  projectId = existingProject.id;
  console.log('  ↻ project already exists:', projectId);
} else {
  projectId = uid();
  db.prepare(`
    INSERT INTO projects (id, name, description, status, owner_id, created_at, updated_at)
    VALUES (?, 'OpenClaw Platform', 'AI agent orchestration SaaS — flagship product', 'active', 'user-scorpion-001', ?, ?)
  `).run(projectId, now, now);
  console.log('  + created  OpenClaw Platform:', projectId);
}

// ── helpers ───────────────────────────────────────────────────────────────────

function upsertAgent({ name, handle, type, mode, model, division, status, pid }) {
  const existing = db.prepare('SELECT id FROM manager_agents WHERE handle = ?').get(handle);
  if (existing) {
    db.prepare(`
      UPDATE manager_agents
      SET agent_type=?, current_mode=?, current_model=?, rnd_division=?, project_id=?, status=?, is_approved=1, updated_at=?
      WHERE handle=?
    `).run(type, mode ?? null, model ?? null, division ?? null, pid ?? null, status, now, handle);
    console.log(`  ↻ updated  @${handle}`);
    return existing.id;
  }
  const agentId = uid();
  db.prepare(`
    INSERT INTO manager_agents
      (id, name, handle, agent_type, current_mode, current_model, rnd_division, project_id, status, is_approved, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,1,?,?)
  `).run(agentId, name, handle, type, mode ?? null, model ?? null, division ?? null, pid ?? null, status, now, now);
  console.log(`  + created  @${handle}`);
  return agentId;
}

function ensureProjectAssignment(agentId, pid) {
  if (!pid) return;
  const existing = db.prepare('SELECT id FROM agent_projects WHERE agent_id=? AND project_id=?').get(agentId, pid);
  if (!existing) {
    db.prepare(`
      INSERT INTO agent_projects (id, agent_id, project_id, role, status, assigned_by, assigned_at)
      VALUES (?,?,?,'worker','active','user-scorpion-001',?)
    `).run(uid(), agentId, pid, now);
  }
}

// ── agents ────────────────────────────────────────────────────────────────────

console.log('\n🤖 Seeding demo agents...\n');

// PM — assigned to OpenClaw Platform
const pmId = upsertAgent({ name: 'ATLAS-PM',    handle: 'atlas_pm',    type: 'pm',     mode: 'saas',     model: 'sonnet', status: 'online',  pid: projectId });

// Workers — assigned to project with dept
const w1 = upsertAgent({ name: 'NOVA-FE',       handle: 'nova_fe',     type: 'worker', mode: 'frontend', model: 'sonnet', status: 'working', pid: projectId });
const w2 = upsertAgent({ name: 'CIPHER-BE',     handle: 'cipher_be',   type: 'worker', mode: 'backend',  model: 'sonnet', status: 'working', pid: projectId });
const w3 = upsertAgent({ name: 'IRON-OPS',      handle: 'iron_ops',    type: 'worker', mode: 'devops',   model: 'haiku',  status: 'online',  pid: projectId });
const w4 = upsertAgent({ name: 'LENS-UX',       handle: 'lens_ux',     type: 'worker', mode: 'uiux',     model: 'opus',   status: 'online',  pid: projectId });

// Free workers — no project, no mode
const w5 = upsertAgent({ name: 'GRID-DB',       handle: 'grid_db',     type: 'worker', mode: null, model: null, status: 'online' });
const w6 = upsertAgent({ name: 'SHIELD-SEC',    handle: 'shield_sec',  type: 'worker', mode: null, model: null, status: 'idle'   });
const w7 = upsertAgent({ name: 'PULSE-QA',      handle: 'pulse_qa',    type: 'worker', mode: null, model: null, status: 'online' });

// R&D — always on, no project
const r1 = upsertAgent({ name: 'SEER-AI',       handle: 'seer_ai',     type: 'rnd', division: 'ai_ml_research', status: 'working' });
const r2 = upsertAgent({ name: 'GHOST-SEC',     handle: 'ghost_sec',   type: 'rnd', division: 'security_intel', status: 'online'  });

// Wire assigned agents into agent_projects junction
console.log('\n🔗 Linking agents to project...\n');
for (const agentId of [pmId, w1, w2, w3, w4]) {
  ensureProjectAssignment(agentId, projectId);
  console.log(`  ✓ linked agent ${agentId.slice(0,8)}... → project`);
}

// ── demo tasks ────────────────────────────────────────────────────────────────

console.log('\n📋 Seeding demo tasks...\n');

function upsertTask({ title, agentId, pid, status }) {
  const existing = db.prepare('SELECT id FROM tasks WHERE title=? AND project_id=?').get(title, pid);
  if (existing) { console.log(`  ↻ task exists: ${title}`); return existing.id; }
  const taskId = uid();
  db.prepare(`
    INSERT INTO tasks (id, title, description, status, project_id, agent_id, priority, assigned_by, created_at, updated_at)
    VALUES (?,?,?,?,?,?,2,'user-scorpion-001',?,?)
  `).run(taskId, title, `Auto-generated demo task: ${title}`, status, pid, agentId, now, now);
  console.log(`  + task: ${title} [${status}]`);
  return taskId;
}

upsertTask({ title: 'Build login & auth UI',         agentId: w1, pid: projectId, status: 'running'   });
upsertTask({ title: 'REST API — agents endpoint',    agentId: w2, pid: projectId, status: 'running'   });
upsertTask({ title: 'Docker Compose setup',          agentId: w3, pid: projectId, status: 'completed' });
upsertTask({ title: 'Design system — color tokens',  agentId: w4, pid: projectId, status: 'pending'   });
upsertTask({ title: 'Define SaaS product strategy',  agentId: pmId, pid: projectId, status: 'running' });

// ── summary ───────────────────────────────────────────────────────────────────

const agentCount  = db.prepare("SELECT COUNT(*) as n FROM manager_agents WHERE is_approved=1").get().n;
const projectCount = db.prepare("SELECT COUNT(*) as n FROM projects WHERE status='active'").get().n;
const taskCount   = db.prepare("SELECT COUNT(*) as n FROM tasks WHERE project_id=?").get(projectId).n;

console.log(`
✅ Demo seed complete!
   Agents   : ${agentCount}  (4 assigned to OpenClaw Platform, 3 free, 2 R&D)
   Projects : ${projectCount} active
   Tasks    : ${taskCount} in OpenClaw Platform

→ http://localhost:5174/hq
`);

db.close();
