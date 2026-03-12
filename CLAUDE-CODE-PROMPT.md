# Claude Code Prompt — Paste This

Copy the OPENCLAW-SPEC.md file into your project root, then run Claude Code with this prompt:

---

```
Read the file OPENCLAW-SPEC.md in the project root COMPLETELY before doing anything. This is the full architecture specification for the OpenClaw dynamic agent orchestration system.

After reading, implement the system starting with Phase 1 (Foundation):

1. Set up the monorepo with Turborepo — apps/web (React), apps/api (Node.js Express), packages/cli, packages/shared
2. Create the Prisma schema with ALL data models from the spec (Agent, Project, Assignment, Preset, Message)
3. Build the backend API with all routes from Section 5.4
4. Build the CLI tool with Commander.js — register, checkin, status, inventory, load-mode, unload, offline commands
5. Build the React frontend starting with the Agent Inventory Dashboard — this is the most important component

For the Agent Inventory UI:
- Use @dnd-kit/core for drag-and-drop
- Three zones: Free Pool (top), Active Projects (middle), R&D Panel (bottom)  
- Agent cards are draggable between Free Pool and Project slots
- Dropping a worker on a project opens a modal to select department (14 options) + AI model
- Dropping a PM on a project opens a modal to select project mode (10 options)
- Real-time updates via Socket.io — when an agent registers via CLI, it appears in the UI instantly
- Color-coded department badges, status dots, model indicators on each agent card
- Dark theme matching the spec aesthetic

For the CLI:
- `openclaw register --type worker --name "Worker-01"` registers an agent via the API
- Agent gets back an ID + token stored in ~/.openclaw/config.json
- `openclaw checkin` sends heartbeat
- `openclaw inventory` lists all agents with their status
- `openclaw load-mode --mode frontend` loads a department preset

Create the /presets folder structure with placeholder .md files for all 10 PM modes, 14 worker departments, and 6 R&D divisions.

Use PostgreSQL + Redis + Docker Compose for infrastructure. TypeScript everywhere. Follow the exact folder structure from Section 5.6 of the spec.

Start implementing now. Do Phase 1 first, then continue through each phase.
```

---

## Alternative: If you want to go step by step

Instead of one big prompt, you can feed Claude Code incrementally:

### Step 1 — Setup
```
Read OPENCLAW-SPEC.md completely. Then set up the monorepo structure from Section 5.6 with Turborepo. Initialize apps/web (React + Vite + TypeScript + Tailwind), apps/api (Node.js + Express + TypeScript), packages/cli (Commander.js + TypeScript), packages/shared (shared types). Create docker-compose.yml with PostgreSQL and Redis. Create the Prisma schema from Section 5.3.
```

### Step 2 — Backend API
```
Referring to OPENCLAW-SPEC.md Sections 5.3 and 5.4, build the full backend API. All agent routes (register, checkin, list, update, delete), all project routes, assignment routes, preset routes, message routes, and dashboard routes. Add Socket.io for real-time events — emit on agent status change, new message, project update. Add agent heartbeat monitoring with Redis.
```

### Step 3 — CLI Tool
```
Referring to OPENCLAW-SPEC.md Section 5.2, build the CLI tool. All commands: register, checkin, status, accept, complete, load-mode, unload, inventory, offline. Store config in ~/.openclaw/config.json. The CLI communicates with the backend API via HTTP. Make it feel clean — colored output, spinners for async operations, table formatting for inventory listing.
```

### Step 4 — Agent Inventory UI (The Big One)
```
Referring to OPENCLAW-SPEC.md Section 6, build the Agent Inventory Dashboard with drag-and-drop. This is the most critical UI component. 

Use @dnd-kit/core and @dnd-kit/sortable. Layout: Free Pool at top (draggable agent cards), Active Projects in middle (each project is a drop zone with its team), R&D Panel at bottom.

Drag behaviors:
- Worker from Free Pool → Project = opens dept + model assignment modal
- Worker from Project → Free Pool = releases agent (with confirmation)
- Worker from Project → Project = reassignment (with new dept/model modal)
- PM → Project header = opens project mode selector

Agent cards show: dept icon, agent ID, name, status dot, model badge, current project. Different visual states for free vs assigned. Color-coded borders by department.

Connect via Socket.io for real-time — when agents register via CLI or status changes, cards update live.
```

### Step 5 — Communication System
```
Referring to OPENCLAW-SPEC.md Section 3.1, build the communication system. Project Chat (per-project, all agents + humans), PM DM Hotline (direct to PM, 24/7), R&D Feed (R&D discoveries + upgrade proposals), System Alerts. All channels use WebSocket for real-time. Messages stored in DB. Internal Agent Bus messages get mirrored to Project Chat automatically.
```

### Step 6 — Presets & Everything Else
```
Referring to OPENCLAW-SPEC.md, build: Preset Manager (browse + edit .md files with versioning), Cost Monitor dashboard, R&D Control Panel (schedules, findings, auto-upgrade toggles), System Health view. Then write meaningful content for all 30 preset .md files (10 PM modes, 14 departments, 6 R&D divisions).
```
