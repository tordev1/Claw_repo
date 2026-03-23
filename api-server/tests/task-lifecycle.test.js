/**
 * Task lifecycle smoke tests
 * Uses Node.js built-in test runner (requires Node >= 18)
 *
 * Usage:
 *   node --test tests/task-lifecycle.test.js
 *
 * Requires the API server to be running on localhost:3001
 */

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const BASE = 'http://localhost:3001';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function req(method, path, body, token) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json };
}

async function login() {
  const { status, body } = await req('POST', '/api/auth/login', {
    login: 'Scorpion',
    password: 'Scorpion123',
  });
  assert.equal(status, 200, 'Login should succeed');
  const token = body.token || body.access_token || (body.session && body.session.token);
  assert.ok(token, 'Login response should include a token');
  return token;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test('health check returns ok', async () => {
  const { status, body } = await req('GET', '/health');
  assert.equal(status, 200);
  assert.ok(body.status === 'ok' || body.uptime !== undefined, 'Health endpoint should return ok');
});

test('admin login succeeds', async () => {
  const token = await login();
  assert.ok(typeof token === 'string' && token.length > 0);
});

test('reject invalid login credentials', async () => {
  const { status } = await req('POST', '/api/auth/login', {
    login: 'Scorpion',
    password: 'wrongpassword',
  });
  assert.equal(status, 401, 'Invalid credentials should return 401');
});

test('list projects returns array', async () => {
  const token = await login();
  const { status, body } = await req('GET', '/api/projects', null, token);
  assert.equal(status, 200);
  const list = Array.isArray(body) ? body : (body.projects || body.data || []);
  assert.ok(Array.isArray(list), 'Projects response should be an array');
});

test('list agents returns array', async () => {
  const token = await login();
  const { status, body } = await req('GET', '/api/agents', null, token);
  assert.equal(status, 200);
  const list = Array.isArray(body) ? body : (body.agents || body.data || []);
  assert.ok(Array.isArray(list), 'Agents response should be an array');
});

test('create task requires valid project', async () => {
  const token = await login();
  const { status } = await req('POST', '/api/tasks', {
    title: 'Test task',
    project_id: 'nonexistent-project-id',
  }, token);
  assert.ok(status === 400 || status === 404, 'Creating task with invalid project should fail');
});

test('task lifecycle: create → auto-assign → verify pending', async () => {
  const token = await login();

  // Create a project
  const { status: ps, body: project } = await req('POST', '/api/projects', {
    name: `Test Project ${Date.now()}`,
    description: 'Automated test project',
  }, token);
  assert.equal(ps, 201, 'Project creation should return 201');
  assert.ok(project.id, 'Project should have an id');

  // Create a task in that project
  const { status: ts, body: task } = await req('POST', '/api/tasks', {
    title: 'Smoke test task',
    description: 'Created by automated test',
    project_id: project.id,
  }, token);
  assert.equal(ts, 201, 'Task creation should return 201');
  assert.ok(task.id, 'Task should have an id');
  assert.ok(
    task.status === 'pending' || task.status === 'running',
    `Task status should be pending or running, got: ${task.status}`
  );

  // Clean up: delete the task
  await req('DELETE', `/api/tasks/${task.id}`, null, token);
});

test('unauthenticated requests are rejected', async () => {
  const { status } = await req('GET', '/api/projects');
  assert.ok(status === 401 || status === 403, 'Unauthenticated request should be rejected');
});

test('agent registration flow', async () => {
  const handle = `testbot_${Date.now()}`;
  const { status, body } = await req('POST', '/api/agents/register', {
    name: 'Test Bot',
    handle,
    agent_type: 'worker',
    role: 'Developer',
    skills: ['testing'],
    experience: 'Junior',
  });
  assert.ok(status === 200 || status === 201, `Agent registration should succeed, got ${status}`);
  assert.ok(body.id, 'Registration should return agent id');
  assert.ok(body.token, 'Registration should return a token');
});
