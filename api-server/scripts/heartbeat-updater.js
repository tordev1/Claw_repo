const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, '..', 'data', 'project-claw.db');
const db = new Database(dbPath);

function tick() {
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE manager_agents
    SET last_heartbeat = ?,
        status = CASE WHEN status = 'offline' THEN 'online' ELSE status END,
        updated_at = ?
    WHERE is_approved = 1
  `).run(now, now);
  console.log(`[heartbeat-updater] ${now}`);
}

tick();
setInterval(tick, 60000);
