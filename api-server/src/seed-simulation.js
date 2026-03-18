'use strict';
/**
 * Seed Simulation Script
 * Seeds 1 simulated Mac Mini machine and 4 simulated agents.
 * Uses INSERT OR IGNORE so it is safe to run multiple times.
 *
 * Usage: node src/seed-simulation.js (from api-server/ directory)
 */

const path = require('path');
const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.resolve(__dirname, '../data/project-claw.db');
const db = new Database(DB_PATH);

const now = new Date().toISOString();

// ── 1. Simulated Machine ──────────────────────────────────────────────────────

const MACHINE_ID = 'machine-mac-mini-sim';

db.prepare(`
  INSERT OR IGNORE INTO machines (id, hostname, ip_address, status, metadata, last_seen, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  MACHINE_ID,
  'mac-mini-local',
  '192.168.1.100',
  'active',
  JSON.stringify({
    model: 'Mac Mini M2',
    ram: '16GB',
    storage: '512GB SSD',
    os: 'macOS 14 Sonoma',
    simulated: true,
  }),
  now,
  now,
  now
);

console.log('[seed-simulation] Machine: mac-mini-local (machine-mac-mini-sim)');

// ── 2. Simulated Agents ───────────────────────────────────────────────────────

const agents = [
  {
    id: 'sim-pm-alpha',
    name: 'Alpha PM',
    handle: 'alpha-pm',
    agent_type: 'pm',
    role: 'PM Manager',
    status: 'online',
    is_approved: 1,
    skills: JSON.stringify(['planning', 'delegation', 'coordination']),
    experience_level: 'senior',
    rnd_division: null,
  },
  {
    id: 'sim-worker-frontend',
    name: 'Frontend Dev',
    handle: 'frontend-dev',
    agent_type: 'worker',
    role: 'Frontend Engineer',
    status: 'online',
    is_approved: 1,
    skills: JSON.stringify(['react', 'typescript', 'css', 'ui']),
    experience_level: 'mid',
    rnd_division: null,
  },
  {
    id: 'sim-worker-backend',
    name: 'Backend Dev',
    handle: 'backend-dev',
    agent_type: 'worker',
    role: 'Backend Engineer',
    status: 'online',
    is_approved: 1,
    skills: JSON.stringify(['node', 'fastify', 'sqlite', 'api']),
    experience_level: 'mid',
    rnd_division: null,
  },
  {
    id: 'sim-rnd-researcher',
    name: 'RnD Research',
    handle: 'rnd-researcher',
    agent_type: 'rnd',
    role: 'R&D Researcher',
    status: 'online',
    is_approved: 1,
    skills: JSON.stringify(['research', 'analysis', 'documentation']),
    experience_level: 'senior',
    rnd_division: 'core-research',
  },
];

const insertAgent = db.prepare(`
  INSERT OR IGNORE INTO manager_agents
    (id, name, handle, agent_type, role, status, is_approved, skills, experience_level, rnd_division, created_at, updated_at)
  VALUES
    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

for (const agent of agents) {
  insertAgent.run(
    agent.id,
    agent.name,
    agent.handle,
    agent.agent_type,
    agent.role,
    agent.status,
    agent.is_approved,
    agent.skills,
    agent.experience_level,
    agent.rnd_division,
    now,
    now
  );
  console.log(`[seed-simulation] Agent: ${agent.name} (${agent.id})`);
}

// ── 3. Link agents to mac-mini machine ───────────────────────────────────────

const insertMachineAgent = db.prepare(`
  INSERT OR IGNORE INTO machine_agents (id, machine_id, agent_id, started_at, status)
  VALUES (?, ?, ?, ?, ?)
`);

for (const agent of agents) {
  insertMachineAgent.run(uuidv4(), MACHINE_ID, agent.id, now, 'running');
  console.log(`[seed-simulation] Linked ${agent.name} -> mac-mini-local`);
}

// ── 4. Cost records seed entry for sim-pm-alpha ───────────────────────────────

db.prepare(`
  INSERT OR IGNORE INTO cost_records
    (id, project_id, model, provider, prompt_tokens, completion_tokens, total_tokens, cost_usd, recorded_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  'cost-sim-001',
  null,
  'ollama/qwen2.5-coder:7b',
  'ollama',
  1200,
  450,
  1650,
  0.0,
  now
);

console.log('[seed-simulation] Cost record: cost-sim-001 (ollama/qwen2.5-coder:7b)');
console.log('[seed-simulation] Done. All simulated data inserted (INSERT OR IGNORE — safe to re-run).');

db.close();
