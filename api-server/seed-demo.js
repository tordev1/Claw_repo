/**
 * Demo seed script — run with: node seed-demo.js
 */

const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');

const db = new Database('./data/project-claw.db');

function id() { return uuidv4(); }
function ts(daysAgo, hoursAgo) {
  daysAgo = daysAgo || 0;
  hoursAgo = hoursAgo || 0;
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(d.getHours() - hoursAgo);
  return d.toISOString();
}

// ── 1. Remove junk auto-generated projects ─────────────────────────────────
const junkPrefixes = ['FULL-TEST', 'AUTO-FLOW', 'E2E-TEST', 'LIVE-DEMO', 'Flow Test', 'QuickTest', 'Logic Test', 'OpenClaw Test'];
const allProjects = db.prepare('SELECT id, name FROM projects').all();
const junkIds = allProjects.filter(function(p) {
  return junkPrefixes.some(function(j) { return p.name.indexOf(j) === 0; });
}).map(function(p) { return p.id; });

console.log('Removing junk projects:', junkIds.length);
for (var i = 0; i < junkIds.length; i++) {
  var jid = junkIds[i];
  db.prepare('DELETE FROM tasks WHERE project_id = ?').run(jid);
  db.prepare('DELETE FROM channels WHERE project_id = ?').run(jid);
  db.prepare('DELETE FROM agent_projects WHERE project_id = ?').run(jid);
  db.prepare('DELETE FROM cost_records WHERE project_id = ?').run(jid);
  db.prepare('DELETE FROM projects WHERE id = ?').run(jid);
}

// ── 2. Ensure 3 demo projects exist ────────────────────────────────────────
var remaining = db.prepare('SELECT id, name FROM projects').all();
console.log('Remaining projects:', remaining.map(function(p) { return p.name; }));

function findOrCreate(name, description, daysAgo) {
  var found = remaining.find(function(p) { return p.name === name; });
  if (found) return found.id;
  var newId = id();
  var created = ts(daysAgo);
  db.prepare('INSERT INTO projects (id, name, description, status, owner_id, config, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)').run(newId, name, description, 'active', 'user-scorpion-001', '{}', created, created);
  console.log('Created project:', name);
  return newId;
}

var proj1 = findOrCreate('Alpha Scraper', 'Automated web data collection pipeline', 10);
var proj2 = findOrCreate('AI Platform v2', 'Next-gen AI agent orchestration layer', 20);
var proj3 = findOrCreate('Test Project', 'QA and integration testing suite', 5);

console.log('Projects:', proj1, proj2, proj3);

// ── 3. Tasks ────────────────────────────────────────────────────────────────
db.prepare('DELETE FROM tasks WHERE project_id IN (?,?,?)').run(proj1, proj2, proj3);

var agentRow = db.prepare('SELECT id FROM manager_agents WHERE is_approved = 1 LIMIT 1').get();
var agentId = agentRow ? agentRow.id : null;
var agentName = 'Alpha PM';
if (agentRow) {
  var agentFull = db.prepare('SELECT name FROM manager_agents WHERE id = ?').get(agentRow.id);
  if (agentFull) agentName = agentFull.name;
}

var taskList = [
  // Alpha Scraper
  { proj: proj1, title: 'Set up Playwright scraping framework', status: 'completed', priority: 3, daysAgo: 8 },
  { proj: proj1, title: 'Implement proxy rotation logic', status: 'completed', priority: 2, daysAgo: 6 },
  { proj: proj1, title: 'Build data normalization pipeline', status: 'running', priority: 3, daysAgo: 3 },
  { proj: proj1, title: 'Add rate-limiting and retry logic', status: 'pending', priority: 2, daysAgo: 1 },
  { proj: proj1, title: 'Write scraper unit tests', status: 'pending', priority: 1, daysAgo: 0 },
  // AI Platform v2
  { proj: proj2, title: 'Design multi-agent task routing algorithm', status: 'completed', priority: 4, daysAgo: 15 },
  { proj: proj2, title: 'Implement agent heartbeat system', status: 'completed', priority: 3, daysAgo: 12 },
  { proj: proj2, title: 'Build WebSocket broadcast layer', status: 'completed', priority: 3, daysAgo: 10 },
  { proj: proj2, title: 'Integrate OpenRouter cost tracking', status: 'running', priority: 3, daysAgo: 4 },
  { proj: proj2, title: 'Create admin dashboard API endpoints', status: 'running', priority: 2, daysAgo: 2 },
  { proj: proj2, title: 'Add agent capability matching', status: 'pending', priority: 2, daysAgo: 1 },
  { proj: proj2, title: 'Performance benchmarking suite', status: 'pending', priority: 1, daysAgo: 0 },
  // Test Project
  { proj: proj3, title: 'Auth system integration tests', status: 'completed', priority: 3, daysAgo: 4 },
  { proj: proj3, title: 'Load test API endpoints', status: 'running', priority: 2, daysAgo: 2 },
  { proj: proj3, title: 'Document all REST endpoints', status: 'pending', priority: 1, daysAgo: 1 },
];

var insertTask = db.prepare('INSERT OR IGNORE INTO tasks (id, project_id, agent_id, title, description, status, priority, payload, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)');
for (var t = 0; t < taskList.length; t++) {
  var task = taskList[t];
  var tid = id();
  var created = ts(task.daysAgo);
  insertTask.run(tid, task.proj, agentId, task.title, null, task.status, task.priority, '{}', created, created);
}
console.log('Tasks seeded:', taskList.length);

// ── 4. Messages in general channel ─────────────────────────────────────────
var genChannel = db.prepare("SELECT id FROM channels WHERE type = 'general' AND name = 'general' LIMIT 1").get();
if (genChannel) {
  var existingMsgCount = db.prepare('SELECT COUNT(*) as n FROM messages WHERE channel_id = ?').get(genChannel.id).n;
  if (existingMsgCount < 5) {
    var msgs = [
      { content: 'System initialized. All agents are standing by.', daysAgo: 7 },
      { content: 'Alpha PM: Project Alpha Scraper is now active. Assigning tasks to workers.', daysAgo: 6 },
      { content: 'Worker Agent: Task "Playwright scraping framework" completed successfully.', daysAgo: 5 },
      { content: 'Admin (Scorpion): Running orchestration sweep - 3 tasks auto-assigned.', daysAgo: 4 },
      { content: 'Alpha PM: AI Platform v2 routing algorithm design complete. Moving to implementation.', daysAgo: 3 },
      { content: 'System: Agent heartbeat monitor active. Checking every 60s.', daysAgo: 2 },
      { content: 'Alpha PM: Integration with OpenRouter cost tracking in progress.', daysAgo: 1 },
    ];
    var insertMsg = db.prepare('INSERT INTO messages (id, channel_id, user_id, content, created_at) VALUES (?,?,?,?,?)');
    for (var m = 0; m < msgs.length; m++) {
      var msg = msgs[m];
      var created = ts(msg.daysAgo);
      insertMsg.run(id(), genChannel.id, 'user-scorpion-001', msg.content, created);
    }
    console.log('Messages seeded:', msgs.length);
  } else {
    console.log('Messages already exist:', existingMsgCount);
  }
}

// ── 5. Cost records ─────────────────────────────────────────────────────────
// Check schema
var costSchema = db.prepare('PRAGMA table_info(cost_records)').all();
console.log('cost_records cols:', costSchema.map(function(c) { return c.name; }).join(', '));

var existingCosts = db.prepare('SELECT COUNT(*) as n FROM cost_records').get().n;
console.log('Existing cost records:', existingCosts);

if (existingCosts < 10) {
  var models = [
    { provider: 'claude', model: 'claude-haiku-4-5', ppt: 0.00000025, cpt: 0.00000125 },
    { provider: 'claude', model: 'claude-sonnet-4-6', ppt: 0.000003, cpt: 0.000015 },
    { provider: 'openai', model: 'gpt-4o-mini', ppt: 0.00000015, cpt: 0.0000006 },
    { provider: 'kimi',   model: 'moonshot-v1-8k', ppt: 0.000001, cpt: 0.000003 },
  ];

  var insertCost = db.prepare('INSERT INTO cost_records (id, project_id, user_id, provider, model, prompt_tokens, completion_tokens, total_tokens, cost_usd, recorded_at) VALUES (?,?,?,?,?,?,?,?,?,?)');
  var projects = [proj1, proj2, proj3];
  var costCount = 0;

  for (var day = 13; day >= 0; day--) {
    var recordsPerDay = 3 + Math.floor(Math.random() * 5);
    for (var r = 0; r < recordsPerDay; r++) {
      var mIdx = Math.floor(Math.random() * models.length);
      var mo = models[mIdx];
      var promptTok = 500 + Math.floor(Math.random() * 4000);
      var completionTok = 200 + Math.floor(Math.random() * 2000);
      var totalTok = promptTok + completionTok;
      var cost = parseFloat((promptTok * mo.ppt + completionTok * mo.cpt).toFixed(6));
      var projId = projects[Math.floor(Math.random() * projects.length)];
      var recAt = ts(day, Math.floor(Math.random() * 20));
      insertCost.run(id(), projId, 'user-scorpion-001', mo.provider, mo.model, promptTok, completionTok, totalTok, cost, recAt);
      costCount++;
    }
  }
  console.log('Cost records seeded:', costCount);
}

// ── 6. Activity history ─────────────────────────────────────────────────────
var existingActivity = db.prepare('SELECT COUNT(*) as n FROM activity_history').get().n;
console.log('Activity rows already:', existingActivity);

if (existingActivity < 20) {
  var insertActivity = db.prepare('INSERT INTO activity_history (id, event_type, action, entity_id, entity_title, project_id, project_name, agent_id, agent_name, user_id, metadata, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
  var activities = [
    { type: 'project', action: 'created', title: 'Alpha Scraper', proj: proj1, projName: 'Alpha Scraper', daysAgo: 10 },
    { type: 'project', action: 'created', title: 'AI Platform v2', proj: proj2, projName: 'AI Platform v2', daysAgo: 20 },
    { type: 'agent', action: 'registered', title: agentName, daysAgo: 15 },
    { type: 'agent', action: 'approved', title: agentName, daysAgo: 15, h: 1 },
    { type: 'task', action: 'created', title: 'Set up Playwright scraping framework', proj: proj1, projName: 'Alpha Scraper', daysAgo: 8 },
    { type: 'task', action: 'completed', title: 'Set up Playwright scraping framework', proj: proj1, projName: 'Alpha Scraper', daysAgo: 6 },
    { type: 'task', action: 'created', title: 'Design multi-agent task routing algorithm', proj: proj2, projName: 'AI Platform v2', daysAgo: 15 },
    { type: 'task', action: 'completed', title: 'Design multi-agent task routing algorithm', proj: proj2, projName: 'AI Platform v2', daysAgo: 12 },
    { type: 'task', action: 'created', title: 'Build WebSocket broadcast layer', proj: proj2, projName: 'AI Platform v2', daysAgo: 11 },
    { type: 'task', action: 'completed', title: 'Build WebSocket broadcast layer', proj: proj2, projName: 'AI Platform v2', daysAgo: 10 },
    { type: 'task', action: 'started', title: 'Integrate OpenRouter cost tracking', proj: proj2, projName: 'AI Platform v2', daysAgo: 4 },
    { type: 'task', action: 'started', title: 'Build data normalization pipeline', proj: proj1, projName: 'Alpha Scraper', daysAgo: 3 },
    { type: 'system', action: 'orchestration_sweep', title: 'Auto-assignment sweep completed', daysAgo: 5 },
    { type: 'agent', action: 'status_changed', title: agentName + ' went online', daysAgo: 14 },
  ];
  for (var a = 0; a < activities.length; a++) {
    var act = activities[a];
    var created = ts(act.daysAgo, act.h || 0);
    insertActivity.run(id(), act.type, act.action, id(), act.title, act.proj || null, act.projName || null, agentId, agentName, 'user-scorpion-001', '{}', created);
  }
  console.log('Activity seeded:', activities.length);
}

db.close();
console.log('SEED DONE');
