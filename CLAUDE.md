# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PROJECT-CLAW is a full-stack AI agent management platform. Human admins (Scorpion) manage AI agents that self-register, get approved, receive task assignments, and communicate via a real-time chat system.

Two services run independently:
- **`api-server/`** — Fastify + SQLite backend (port 3001)
- **`web-hq/`** — React + TypeScript + Vite frontend (port 5173)

## Commands

### Backend (`api-server/`)
```bash
npm run dev       # Start with --watch (auto-reload on change)
npm start         # Production start
node resetDB.js   # Wipe all operational data, keep admin user Scorpion (restart server after to re-seed)
```

### Register a test agent (local or Mac Mini on LAN)
```bash
node agentCLI.js --name "AgentName" --handle agenthandle
# From another machine on LAN:
API_URL=http://192.168.1.62:3001 node agentCLI.js --name "OpenClaw" --handle openclaw
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

### Task Lifecycle

```
pending (created) → accepted (agent acks) → running (agent starts) → completed
```

- `acceptTask` — sets `accepted_at` only, does not change `status`
- `startTask` — requires `status === 'pending'`, sets `status = 'running'`
- `completeTask` — requires `status === 'running'`, sets `status = 'completed'`
- All three routes have admin bypass: `task.agent_id !== userId && user.role !== 'admin'`
- To assign a task to an agent, that agent must first be assigned to the project via `agent_projects`

### WebSocket

Single persistent endpoint: `ws://localhost:3001/ws?token=<jwt>`

- Clients with no `channels`/`projects` query params get `isGlobal = true` and receive ALL broadcasts
- **Server-side keepalive**: `socket.ping()` every 30s (cleared on disconnect) in `server.js`
- **`agentCLI.js` client-side keepalive**: masked ping frame (opcode 9) every 25s
- **RFC 6455 masking is required**: `wsSend()` in `agentCLI.js` properly masks all client-to-server frames — the `ws` library drops unmasked frames, causing reconnect loops
- WS manager: `api-server/src/websocket.js` — `WebSocketManager` class, wired in `server.js`

Key WS events: `task:assigned`, `agent:task_assigned`, `task:accepted`, `task:started`, `task:completed`, `chat:message`, `notification:new`

### Chat System

`channels` table has three types: `general`, `project`, `dm`. DM channels link a `user_id` to either another `user_id` OR a `manager_agent` id (stored in `dm_agent_id` — no FK constraint, supports both).

- **Frontend**: Zustand store at `store/chatStore.ts` — single source of truth for channels, messages, agents
- **Backend**: `src/chat.js` — `sendChannelMessage()`, `getChannelMessages()`, `getOrCreateDMChannel()`
- Web sends chat via `POST /api/channels/:id/messages` or WS `chat_message` action
- Agent CLI receives `chat:message` events over WS

### Machine / Mac Mini Tracking

`machines` table + `machine_agents` junction table.

- The `machines` table uses `metadata` column (JSON), **NOT** `specs`
- `listMachinesRoute` in `routes.js` handles machine listing — the separate `machines.js` module (which references `specs`) is **not** wired into any route
- Delete via `DELETE /api/machines/:id` (admin only) — also removes `machine_agents` rows

### Database Seeding

`initDatabase()` in `database.js` is idempotent and runs on every server start. It seeds only:
- Admin user: `Scorpion` / `Scorpion123` (id: `user-scorpion-001`)
- Default channel: `general`

**Sigma agent and sample Mac Mini seeds have been removed** — they no longer reappear after reset.

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

### Frontend State

- **Chat**: Zustand store at `store/chatStore.ts`
- **Notifications**: Zustand store at `store/notificationStore.ts`
- **Session**: `userSession` object in `services/api.ts` (reads/writes `localStorage`)
- **WebSocket**: Singleton `wsClient` (WebSocketClient) exported from `services/api.ts`, connected once at app level in `App.tsx` via `WebSocketManager` component. The connection is intentionally **not** torn down on component unmount.

### Route Guard Pattern

`App.tsx` wraps routes with `ProtectedRoute` (requires login, optionally requires `admin` role) and `ReadOnlyRedirect` (blocks write actions for `readonly` role users).

### Pages — Data Sources

All pages pull from DB. Hardcoded/fake data that was removed:

- **Dashboard**: Real agent count from `agentsApi.list()`, real machine fleet from DB with delete buttons
- **ProjectDetail**: Removed fake CPU/RAM/Disk/Network resource usage, fake GitHub/AWS/Stripe/Vercel/Notion connected resources, hardcoded "CodeDev-1"/"CodeReview-1" workers, hardcoded "14 days" uptime, "2/5 active" workers. Active Agents section now shows real `projectAgents` from DB. Tabs: overview, tasks, costs only.
- **NewProject**: No budget slider. Machine picker shows real machines from `machinesApi.list()` (hostname + IP).

### Backend Route Files

All routes are wired in `server.js`:
- `routes.js` — all main route handlers (projects, tasks, agents, machines, chat, costs, admin)
- `task-routes.js` — additional task route helpers
- `auth.routes.js` — auth endpoints
- `routes-legacy.js` — old routes kept for backward compat (not wired by default)

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

Frontend API URL: `VITE_API_URL` in `web-hq/.env` (defaults to `http://localhost:3001`).
