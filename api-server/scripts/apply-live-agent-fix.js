const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, '..', 'data', 'project-claw.db');
const db = new Database(dbPath);

const now = new Date().toISOString();

// 1) Make agents live-like in UI/runtime
const agentRows = db.prepare(`SELECT id, name, handle FROM manager_agents`).all();
for (const a of agentRows) {
  db.prepare(`
    UPDATE manager_agents
    SET status = 'online',
        last_heartbeat = ?,
        updated_at = ?
    WHERE id = ?
  `).run(now, now, a.id);
}

// 2) Migrate task payloads from claude -> ollama for active work
const tasks = db.prepare(`
  SELECT id, title, payload, status
  FROM tasks
  WHERE status IN ('pending', 'running')
`).all();

let migrated = 0;
for (const t of tasks) {
  let payload = {};
  try { payload = t.payload ? JSON.parse(t.payload) : {}; } catch { payload = {}; }

  // Force active tasks onto local runtime for reliable live testing
  payload.provider = 'ollama';
  payload.model = 'qwen2.5-coder:7b';
  db.prepare(`UPDATE tasks SET payload = ?, updated_at = ? WHERE id = ?`).run(JSON.stringify(payload), now, t.id);
  migrated++;
}

// Also normalize project config provider/model
const projects = db.prepare(`SELECT id, config FROM projects WHERE status = 'active'`).all();
let projectsMigrated = 0;
for (const p of projects) {
  let config = {};
  try { config = p.config ? JSON.parse(p.config) : {}; } catch { config = {}; }
  config.provider = 'ollama';
  config.model = 'qwen2.5-coder:7b';
  db.prepare(`UPDATE projects SET config = ?, updated_at = ? WHERE id = ?`).run(JSON.stringify(config), now, p.id);
  projectsMigrated++;
}

const summary = {
  agentsUpdated: agentRows.length,
  tasksScanned: tasks.length,
  tasksMigrated: migrated,
  projectsMigrated,
  at: now,
};

console.log(JSON.stringify(summary, null, 2));
