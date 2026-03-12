# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PROJECT-CLAW is a full-stack AI agent management platform. Human admins (Scorpion) manage AI agents that self-register, get approved, receive task assignments, and communicate via a real-time chat system.

Two services run independently:
- **`api-server/`** — Fastify + SQLite backend (port 3001)
- **`web-hq/`** — React + TypeScript + Vite frontend (port 5173)

Requires Node.js >= 18.0.0.

## Commands

### Setup (first time or fresh clone)
```bash
cd api-server && npm install
cd web-hq && npm install
```

The root `package.json` mirrors backend scripts — `npm run dev` and `npm start` from root both run the api-server.

### Backend (`api-server/`)
```bash
npm run dev       # Start with --watch (auto-reload on change)
npm start         # Production start
node resetDB.js   # Wipe all operational data, keep admin user Scorpion (restart server after to re-seed)
npm run seed      # Seed database with mock data (src/seed.js)
npm run seed:full # Full seed (seed-new.js)
npm run migrate   # Run migrations (scripts/migrate.js)
npm run sync:costs # One-shot OpenRouter cost sync
```

**Note**: npm scripts use `set NODE_ENV=...` (Windows syntax). On Mac/Linux, replace with `NODE_ENV=... node ...` or use cross-env.

### Register a test agent (local or Mac Mini on LAN)
```bash
node agentCLI.js --name "AgentName" --handle agenthandle
# From another machine on LAN (update IP to match `ipconfig` output on Windows host):
API_URL=http://192.168.1.94:3001 node agentCLI.js --name "OpenClaw" --handle openclaw
```

### Frontend (`web-hq/`)
```bash
npm run dev       # Vite dev server with --host (LAN accessible)
npm run build     # tsc + vite build
npm run lint      # ESLint
```

No test suite is configured — `npm test` references paths that don't exist.

## Architecture

### Database — Two Agent Tables (Critical Distinction)

| Table | Purpose |
|-------|---------|
| `agents` | Legacy table, agents belong to a `project_id`. Used by old routes only. |
| `manager_agents` | Active table. Self-registering CLI agents with approval workflow. |

All new agent features use `manager_agents`. Do not confuse these tables.

**FK targets**: `tasks`, `messages`, `channel_members`, `typing_indicators`, `dm_channels` all reference `manager_agents(id)` — **not** the legacy `agents` table. `database.js` contains `_migrateTableFK()` which auto-migrates existing DBs with wrong FK targets on startup.

**`activity_history` table**: Persists all platform events (`task`, `agent`, `project`, `system` types). Columns: `id, event_type, action, entity_id, entity_title, project_id, project_name, agent_id, agent_name, user_id, metadata (JSON), created_at`. Populated by route handlers in `routes.js` on key events (task lifecycle, agent assignment, project creation). Queried by `GET /api/activity`.

### Auth System

Auth is **user-token only** — no agent tokens exist. Agents authenticate by registering at `POST /api/agents/register`, which internally calls `createSession('user-scorpion-001')` server-side and returns a token to the agent. **Admin credentials are never transmitted to or from agents.**

- `auth.js` — `createSession(userId)`, `getUserByToken(token)`, `authenticateUser()`, bcryptjs hashing
- `auth.middleware.js` — `authMiddleware` / `optionalAuthMiddleware` for Fastify preHandlers
- Token stored in `user_sessions` table; validated per-request by `getUserByToken()`
- Frontend: JWT stored in `localStorage('claw_token')`, injected by `fetchApi()` in `services/api.ts`
- Admin credentials: `Scorpion / Scorpion123` (id: `user-scorpion-001`)

### Agent Registration Flow (agentCLI.js)

1. `POST /api/agents/register` — agent registers, server auto-creates session, returns `{ id, token }`
2. Agent polls `GET /api/agents/:id` every 3s waiting for `is_approved === true`
3. Admin approves at `/admin` panel → agent calls `POST /api/agents/:id/status` to go online
4. Agent connects to WebSocket at `ws://host:3001/ws?token=<jwt>`

**agentCLI capabilities**: Handles `task:assigned`/`agent:task_assigned` (auto accept→start→complete), `chat:message` (auto-replies in channel if DM or @mentioned), `project:created`, `agent:assigned_to_project`, `agent:removed_from_project`, `notification:new`. Sends messages via `POST /api/channels/:id/messages` with `agent_id` in the body so messages are attributed to the agent, not Scorpion.

**agentCLI spam guards**: `repliedMessages` Set (dedupes by message ID), `channelCooldown` Map (max one auto-reply per channel per 3s). The `isMine` check (`sender_id === agentId`) relies on correct `agent_id` threading — if the server is old and returns `sender_id = 'user-scorpion-001'`, the loop will re-activate.

### Task Lifecycle

```
pending (created) → accepted (agent acks) → running (agent starts) → completed | failed | cancelled
```

- `acceptTask` — sets `accepted_at` only, does not change `status`
- `startTask` — requires `status === 'pending'`, sets `status = 'running'`
- `completeTask` — requires `status === 'running'`, sets `status = 'completed'` (manual/legacy)
- `executeTaskRoute` (`POST /api/tasks/:id/execute`) — requires `running`, calls OpenRouter LLM via `ai-executor.js`, stores result, tracks cost in `cost_records`, posts to project channel, marks `completed`
- All routes have admin bypass: `task.agent_id !== userId && user.role !== 'admin'`
- To assign a task to an agent, that agent must first be assigned to the project via `agent_projects`

### AI Executor (`src/ai-executor.js`)

Standalone LLM module. Requires `OPENROUTER_API_KEY` in env.
- `executeTask(task, agent, project)` → `{ result, model, tokens, cost, skipped }`
- Type-aware system prompts: PM (planning), Worker (technical/code), R&D (research)
- Model: `agent.current_model` → type default (`claude-haiku-4-5` for PM/Worker, `claude-sonnet-4-6` for R&D)
- No key → `skipped: true`, simulated result, no crash
- **Note**: The frontend `Task` TypeScript interface in `api.ts` lists statuses `draft | assigned | in_progress` that do not exist in the backend DB. The backend is authoritative: `pending`, `running`, `completed`, `failed`, `cancelled`.

### WebSocket

Single persistent endpoint: `ws://localhost:3001/ws?token=<jwt>`

- Clients with no `channels`/`projects` query params get `isGlobal = true` and receive ALL broadcasts
- **Server-side keepalive**: `socket.ping()` every 30s (cleared on disconnect) in `server.js`
- **`agentCLI.js` client-side keepalive**: masked ping frame (opcode 9) every 25s
- **RFC 6455 masking is required**: `wsSend()` in `agentCLI.js` properly masks all client-to-server frames — the `ws` library drops unmasked frames, causing reconnect loops
- WS manager: `api-server/src/websocket.js` — `WebSocketManager` class, wired in `server.js`

Key WS events: `task:assigned`, `agent:task_assigned`, `task:accepted`, `task:started`, `task:completed`, `task:rejected`, `chat:message`, `notification:new`, `project:created`, `agent:assigned_to_project`, `agent:removed_from_project`

**Payload convention**: All task events carry `task_id`, `task_title`, `project_id`, `project_name`, `agent_id`, `agent_name`. Use `task_title` — not `title` — for task name. The `emitProjectStatusChanged` signature is `(projectId, oldStatus, newStatus, projectName)`.

### Chat System

`channels` table has three types: `general`, `project`, `dm`. DM channels link a `user_id` to either another `user_id` OR a `manager_agent` id (stored in `dm_agent_id` — no FK constraint, supports both).

- **Frontend**: Zustand store at `store/chatStore.ts` — single source of truth for channels, messages, agents
- **Backend**: `src/chat.js` — `sendChannelMessage()`, `getChannelMessages()`, `getOrCreateDMChannel()`
- Web sends chat via `POST /api/channels/:id/messages` or WS `chat_message` action
- Agent CLI sends messages via `POST /api/channels/:id/messages` with `{ content, agent_id }` — the route validates `agent_id` against `manager_agents`, then passes it to `sendChannelMessage()` which stores `agent_id` (not `user_id`) and broadcasts `sender_id: agentId`, `sender_type: 'agent'`, `sender_name: agentName`
- **`POST /api/channels/:id/messages` body schema** (in `server.js`): `content` (required), `metadata` (object), `agent_id` (string). Fastify strips unknown fields — any new body field must be added to the schema.
- `getAgentByIdentifier()` in `chat.js` queries `manager_agents` (not legacy `agents`); supports lookup by name, handle (with/without `@`), or id
- Frontend `Chat.tsx` renders sender name as `msg.sender_name || msg.user_name || msg.agent_name` — covers both live WS messages and DB-fetched history

### Machine / Mac Mini Tracking

`machines` table + `machine_agents` junction table.

- The `machines` table uses `metadata` column (JSON), **NOT** `specs`
- `listMachinesRoute` in `routes.js` handles machine listing — the separate `machines.js` module (which references `specs`) is **not** wired into any route
- Delete via `DELETE /api/machines/:id` (admin only) — also removes `machine_agents` rows

### Database Seeding

`initDatabase()` in `database.js` is idempotent and runs on every server start. It seeds only:
- Admin user: `Scorpion` / `Scorpion123` (id: `user-scorpion-001`)
- Default channel: `general`

`resetDB.js` wipes all operational tables but preserves `user-scorpion-001`. Restart the server after reset to re-seed the general channel.

### Frontend API Layer (`web-hq/src/services/api.ts`)

All API calls go through `fetchApi()` which injects `Authorization: Bearer <token>` from `localStorage('claw_token')`.

Key API objects and their correct endpoints:
- `tasksApi.create(projectId, data)` → `POST /api/tasks` (sends `project_id` in body)
- `tasksApi.decline(taskId)` → `POST /api/tasks/:id/reject`
- `agentsApi.assignToProject(agentId, projectId)` → `POST /api/projects/:id/assign-agent`
- `projectAgentsApi.listByProject(projectId)` → `GET /api/projects/:id/agents`
- `adminApi.approveAgent(id)` → `POST /api/admin/agents/:id/approve`
- `adminApi.rejectAgent(id)` → `POST /api/admin/agents/:id/reject`
- `machinesApi.delete(id)` → `DELETE /api/machines/:id`
- `fetchApi('/api/activity?limit=N&type=task|agent|project&project_id=...&agent_id=...')` → paginated `{ activities, total, limit, offset }` from `activity_history` table

### Frontend State

- **Chat**: Zustand store at `store/chatStore.ts`
- **Notifications**: Zustand store at `store/notificationStore.ts`
- **Session**: `userSession` object in `services/api.ts` (reads/writes `localStorage`)
- **WebSocket**: Singleton `wsClient` (WebSocketClient) exported from `services/api.ts`, connected once at app level in `App.tsx` via `WebSocketManager` component. The connection is intentionally **not** torn down on component unmount.

### Route Guard Pattern

`App.tsx` wraps routes with `ProtectedRoute` (requires login, optionally requires `admin` role) and `ReadOnlyRedirect` (blocks write actions for `readonly` role users).

### Pages — Data Sources

All pages pull from DB (no hardcoded/fake data):

- **Dashboard**: Agent count from `agentsApi.list()`, machine fleet from DB with delete buttons
- **ProjectDetail**: Active Agents from `projectAgents` (DB). Tabs: overview, tasks, costs only.
- **NewProject**: Machine picker shows real machines from `machinesApi.list()` (hostname + IP).
- **Activity**: Loads from `GET /api/activity` (backed by `activity_history` table). Supports live WS updates for all task/agent/project events. Does **not** fall back to `/api/tasks`.

### Backend Route Files

All routes are wired in `server.js`:
- `routes.js` — all main route handlers (projects, tasks, agents, machines, chat, costs, admin)
- `task-routes.js` — additional task route helpers
- `auth.routes.js` — auth endpoints
- `routes-legacy.js` — old routes kept for backward compat (not wired by default)

### Other Backend Modules

- `notifications.js` — notification creation/retrieval for both users and agents; wired in `routes.js` for task lifecycle events (`notifyTaskAssigned/Accepted/Rejected/Completed`) and agent project assignment (`notifyAgentProjectAssigned`)
- `openrouter.js` — fetches real usage/cost data from OpenRouter API; requires `OPENROUTER_API_KEY` env var
- `token-dashboard.js` — per-provider token stats (Kimi, OpenAI, Claude); endpoints under `/api/tokens/*`
- `token-monitoring.js` — dashboard summary, daily usage, model breakdown; endpoints under `/api/monitoring/*`
- `real-costs.js` — aggregates actual cost data from multiple providers
- `subagents.js` — legacy agent spawning via `exec`; uses the legacy `agents` table (not `manager_agents`)
- `auth.service.js` — thin service wrapper around auth logic; `auth.js` is the primary auth module

## Operational Tips

**Remove a stale agent handle without full reset** (e.g. "Handle @openclaw already exists"):
```bash
node -e "const DB = require('better-sqlite3'); const db = new DB('./data/project-claw.db'); db.prepare(\"DELETE FROM manager_agents WHERE handle = 'openclaw'\").run(); console.log('done');"
```
No server restart needed. Then re-run `agentCLI.js`.

## E2E Test Flow

```bash
# 1. Reset + restart backend
cd api-server && node resetDB.js && npm run dev

# 2. Start agent CLI
node agentCLI.js --name "TestAgent" --handle testagent

# 3. In browser: approve agent at localhost:5173/admin

# 4. Create project at localhost:5173/new-project
# 5. Assign agent to project via project detail page
# 6. Create task in project and assign it to the agent
# 7. CLI auto-accepts, starts, and completes the task

# Chat test: send a DM or @mention the agent in any channel — CLI logs message and auto-replies
# Activity test: visit localhost:5173/activity — events appear live from activity_history
```

## Environment Variables (Backend)

| Variable | Default | Notes |
|----------|---------|-------|
| `PORT` | `3001` | |
| `HOST` | `0.0.0.0` | |
| `DB_PATH` | `./data/project-claw.db` | SQLite file |
| `DB_TYPE` | `sqlite` | Set to `postgresql` + `DATABASE_URL` for Postgres |
| `CORS_ORIGIN` | dev defaults | Comma-separated origins |
| `API_URL` | `http://localhost:3001` | Used by `agentCLI.js` |
| `OPENROUTER_API_KEY` | — | Required for cost/usage sync via `openrouter.js` |

Frontend env vars in `web-hq/.env`:
- `VITE_API_URL` — defaults to `http://localhost:3001`
- `VITE_WS_URL` — defaults to `ws://localhost:3001/ws`

## Docker

Docker Compose files are provided at the repo root:
- `docker-compose.yml` — dev/default setup (api on port 3001, web on port 80)
- `docker-compose.prod.yml` — production overrides (resource limits, logging, restart policies)

Both `api-server/` and `web-hq/` have their own `Dockerfile`. The API service exposes a `/health` endpoint used by the Docker healthcheck.
