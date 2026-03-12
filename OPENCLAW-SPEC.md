# OpenClaw — Dynamic Agent Orchestration System

## Implementation Prompt for Claude Code

> **IMPORTANT**: Read this ENTIRE document before writing any code. This is the full architecture specification for the OpenClaw agent system. Every section is interconnected. Do not start implementing until you understand how all pieces fit together.

---

## 1. WHAT IS OPENCLAW

OpenClaw is a **dynamic agent inventory system** for software development. There are NO fixed teams. Instead, there is a **pool of agents** that get assembled into project teams on demand, work on the project, then return to the pool when done.

Think of it like a staffing agency — but for AI agents that can instantly switch roles.

### Core Philosophy
- **No fixed teams** — teams form per project and dissolve after
- **Mode-based specialization** — every agent can be anything, they just load different `.md` preset files
- **Dynamic scaling** — need 3 agents? Take 3. Need 12? Take 12. Done? Return them all.
- **24/7 operations** — agents don't sleep, take breaks, or get sick
- **API-first, local-LLM later** — architecture is model-agnostic

---

## 2. THE THREE AGENT TYPES

There are exactly **3 types of agents** in OpenClaw. Nothing more, nothing less.

### 2.1 Project Manager (PM) Agents

**What they do**: Receive a project → load a project-type mode → analyze scope → spawn sub-agents for planning → pick free worker agents from the inventory → assign each worker a department role + AI model → coordinate the entire project → release workers back to pool when done.

**Key behaviors**:
- PM agents have **project mode presets** (`.md` files) — one for each type of project
- When a project comes in, the PM loads the matching mode (e.g., `modes/webstore.md`)
- The mode contains: boilerplate architecture, task breakdown templates, resource estimation formulas, typical team compositions, common pitfalls
- PM agents can **spawn sub-agents** (using openclaw's sub-agent system) for parallel work:
  - `task_decomposition` sub-agent — breaks project into tasks
  - `resource_planning` sub-agent — estimates effort per task
  - `model_selection` sub-agent — picks best AI model per department role
- PM agents are available **24/7 via DM hotline** on Web-HQ
- PM agents post all decisions to the Project Chat for human visibility

**Project Mode Presets** (10 modes):

| Mode ID | Name | Typical Team Composition |
|---------|------|--------------------------|
| `webstore` | Web Store / E-commerce | Frontend, Backend, Database, DevOps, UI/UX, QA |
| `saas` | SaaS Platform | Frontend, Backend, Database, DevOps, Security, API & Integration |
| `mobile_app` | Mobile Application | Mobile Dev, Backend, UI/UX, QA, DevOps |
| `data_pipeline` | Data Pipeline | Data Engineering, Backend, DevOps, Performance |
| `ai_ml_product` | AI/ML Product | ML Engineering, Backend, Data Engineering, DevOps, Performance |
| `api_platform` | API Platform | Backend, API & Integration, Content & Docs, Security, QA |
| `cms` | CMS / Content Platform | Frontend, Backend, Database, UI/UX, Content & Docs |
| `internal_tools` | Internal Tools | Frontend, Backend, Database, QA |
| `gaming` | Gaming | Frontend, Backend, Performance, DevOps, QA |
| `iot_system` | IoT System | Backend, DevOps, Data Engineering, Security, Performance |

Each mode's `.md` file should contain:
```
# Mode: [Name]
## Overview
[What this project type is, common patterns]
## Architecture Template  
[Default architecture decisions, tech stack recommendations]
## Task Breakdown Template
[Standard task categories for this project type]
## Team Composition
[Which departments are needed, suggested agent count per dept]
## Model Recommendations
[Which AI model works best for each department in this project type]
## Common Pitfalls
[Things that usually go wrong in this project type]
## Boilerplate
[Starter code, configs, folder structures]
```

---

### 2.2 Worker Agents

**What they do**: Sit in the free pool until a PM agent picks them → receive a department role assignment + AI model spec → load the department preset (`.md` file) → become that department specialist → work on assigned tasks → unload mode and return to free pool when project ends.

**Key behaviors**:
- **EVERY worker agent carries ALL department presets** — they all know the same things
- The PM just tells them which mode to activate
- Once assigned, the worker is **locked into that role** until released
- Same agent might be Frontend on Project A, then DevOps on Project B
- Workers communicate with each other via the **Internal Agent Bus** (invisible to humans)
- All important decisions get **mirrored to the Project Chat** (visible to humans)

**Department Presets** (14 departments):

| Dept ID | Name | Description |
|---------|------|-------------|
| `frontend` | Frontend UI | React/Vue/Angular, components, state management, responsive design, accessibility |
| `backend` | Backend | API design, server logic, microservices, auth, business logic, caching |
| `devops` | DevOps | CI/CD, Docker/K8s, IaC (Terraform), monitoring, logging, cloud infra |
| `database` | Database Engineering | Schema design, query optimization, migrations, replication, sharding |
| `mobile` | Mobile Development | iOS/Android/cross-platform, native perf, push notifications, offline-first |
| `security` | Security | Pen testing, vulnerability scanning, encryption, compliance, incident response |
| `qa` | QA & Testing | Unit/integration/e2e, test automation, load testing, regression, bug triage |
| `uiux` | UI/UX Design | Wireframes, prototypes, user research, usability testing, design systems |
| `data_engineering` | Data Engineering | ETL pipelines, data warehousing, stream processing, Spark/Kafka |
| `ml_engineering` | ML Engineering | Model training/deployment, MLOps, feature engineering, model monitoring |
| `api_integration` | API & Integration | REST/GraphQL/gRPC, third-party integrations, webhooks, SDK development |
| `performance` | Performance | Load testing, bottleneck analysis, caching, CDN, Core Web Vitals |
| `content_docs` | Content & Docs | Technical writing, API docs, user guides, marketing copy, knowledge base |
| `release_eng` | Release Engineering | Version management, feature flags, rollbacks, changelogs, deployment |

Each department preset `.md` file should contain:
```
# Department: [Name]
## Role Definition
[What this department does, scope of responsibility]
## Tools & Technologies
[Frameworks, languages, tools this department uses]
## Standards & Best Practices
[Coding standards, review checklists, quality gates]
## Communication Protocol
[How to coordinate with other departments, what to report to PM]
## Task Types
[Common task categories this department handles]
## AI Model Recommendation
[Which model works best for this department's tasks]
```

---

### 2.3 R&D Agents

**What they do**: Run autonomously on **scheduled intervals** (NOT 24/7 polling). They scan the tech/AI landscape, discover improvements, and **auto-upgrade PM modes and worker department presets**. They feed intelligence back into the entire system.

**Key behaviors**:
- R&D agents are NEVER assigned to projects — they run independently
- They use **cheaper models** (Haiku-tier) since their work is research/summarization
- They post findings to the **R&D Feed** channel on Web-HQ
- They can **auto-upgrade presets** or **propose upgrades** for human approval
- They feed improvements into: PM project modes, worker department presets, model registry, system config

**R&D Divisions** (6 divisions):

| Division ID | Name | Schedule | Model | Feeds Into |
|-------------|------|----------|-------|------------|
| `ai_ml_research` | AI/ML Research | Every 6 hours | Haiku | Worker presets, Model registry |
| `tech_frameworks` | Tech & Framework News | Daily | Haiku | Worker presets, PM modes |
| `security_intel` | Security Intelligence | Every 4 hours | Sonnet (higher stakes) | Worker presets, System config |
| `oss_scout` | Open Source Scout | Daily | Haiku | Worker presets |
| `tooling_infra` | Tooling & Infrastructure | Weekly | Haiku | DevOps preset, PM modes |
| `competitive_intel` | Competitive Intelligence | Weekly | Haiku | PM modes |

---

## 3. WEB-HQ PLATFORM

The Web-HQ is the **central command** for the entire OpenClaw system. It's a web application where humans manage agents, monitor projects, and communicate with PM agents.

### 3.1 Communication Channels

| Channel | Purpose | Who Sees It |
|---------|---------|-------------|
| **Project Chat** | Per-project channel. All agents post here. Internal decisions mirrored for visibility. PM moderates. | Humans + All project agents |
| **PM DM Hotline** | Direct message to any active PM agent. 24/7 availability. Human override — scope changes, priority shifts, emergency stops. | Human + specific PM agent |
| **Internal Agent Bus** | Agent-to-agent communication. FE ↔ BE negotiate API contracts. DevOps ↔ BE coordinate deploys. Fast, no human overhead. | Agents only (mirrored to Project Chat) |
| **R&D Feed** | R&D agents post discoveries, upgrade proposals, security alerts. PM agents subscribe. | Humans + PM agents + R&D agents |
| **System Alerts** | Health monitoring, cost alerts, agent failures, stuck tasks. | Humans + PM agents |

### 3.2 Communication Flow

```
Frontend Agent ←──── Internal Bus ────→ Backend Agent
      │          (negotiate API contract)         │
      │                                           │
      └──────────────┬────────────────────────────┘
                     │ mirror to Project Chat
                     ▼
┌──────────────────────────────────────────────────┐
│  PROJECT CHAT                                     │
│  "FE & BE agreed: REST API with /products,        │
│   /cart, /checkout endpoints. Schema attached."    │
│                                                    │
│  Human can see everything · PM moderates           │
└──────────────────────────────────────────────────┘
                     │
                     │ human sends DM to PM
                     ▼
┌──────────────────────────────────────────────────┐
│  PM DM HOTLINE                                    │
│  Human: "Add GraphQL support too"                 │
│  PM: "Understood. Reassigning API agent to add    │
│       GraphQL layer. ETA: +4hrs. Updating plan."  │
└──────────────────────────────────────────────────┘
```

### 3.3 Web-HQ Modules

1. **Agent Inventory Dashboard** — Real-time view of ALL agents: free, assigned, current mode, current model, current project. **Drag-and-drop** interface for manual reassignment.

2. **Project Dashboard** — All active projects, their teams, progress, blockers, costs. Kanban boards auto-generated from PM task breakdowns.

3. **Preset Manager** — Browse, edit, version-control all `.md` presets (PM modes + worker departments). See R&D proposed changes before approving.

4. **Cost Monitor** — Real-time API spend per project, per agent, per model. Alerts when projects exceed budget. Historical analytics.

5. **R&D Control Panel** — Set schedules per R&D division. Review findings. Approve/reject auto-upgrades. Priority overrides.

6. **Model Registry** — Available AI models, their costs, capabilities. R&D recommends swaps. PM selects per-project.

---

## 4. PROJECT LIFECYCLE

Every project goes through this exact lifecycle:

### Phase 1: INTAKE
1. **Project Request** — Human submits project via Web-HQ with requirements, scope, deadline, budget
2. **PM Activation** — System picks a free PM agent. PM loads matching project mode preset

### Phase 2: PLANNING
3. **Sub-Agent Planning** — PM spawns parallel sub-agents: task decomposition, resource estimation, model selection. Results collected in seconds.
4. **Team Design** — PM determines: which departments needed, how many workers per dept, which AI model per role, timeline & cost estimate

### Phase 3: ASSEMBLY
5. **Worker Allocation** — PM checks agent inventory → picks N free workers → sends each: department role + AI model spec
6. **Mode Loading** — Each worker loads assigned `.md` preset + switches to specified model. Status: `free` → `locked_in:{dept}`. Team is live.

### Phase 4: EXECUTION
7. **Sprint Execution** — Workers operate in department modes. Internal bus for coordination. Decisions mirrored to Project Chat.
8. **PM Coordination** — PM monitors progress, resolves blockers, adjusts team (spawn more workers or release unneeded ones mid-project)
9. **R&D Live Feed** — R&D pushes relevant upgrades: security patches, better libraries, new models. PM decides whether to apply.

### Phase 5: DELIVERY
10. **QA & Review** — QA workers run full test suites. PM reviews against scope. Human gets notification for approval.
11. **Ship** — Release Eng worker deploys. DevOps worker manages infra. Project marked complete.
12. **Release & Learn** — All workers unload modes → return to free pool. PM logs learnings → R&D analyzes for preset improvements.

---

## 5. WHAT TO BUILD NOW

### 5.1 Agent Inventory System with Drag-and-Drop UI

Build a **web application** (React + Node.js backend) with the following:

#### Agent Inventory Dashboard

The main view showing all agents in the system as cards/tiles in a grid. Each agent card shows:
- Agent ID / Name
- Agent Type (PM / Worker / R&D)
- Current Status: `free` | `assigned` | `busy` | `offline`
- Current Mode (if assigned): e.g., "Frontend UI" or "Web Store PM"
- Current AI Model: e.g., "claude-sonnet-4-20250514" or "claude-haiku-4-5-20251001"
- Current Project (if assigned)

**Drag-and-Drop Behavior**:
- Agents can be **dragged from the free pool** into a **project slot**
- When dropped, a modal appears asking: which department role? which AI model?
- Agent status changes to `assigned`, mode loads
- Agents can be **dragged back to the free pool** to release them
- Agents can be **dragged between projects** (reassignment)

#### PM Agent Inventory (Separate Section)

A dedicated section for PM agents showing:
- All PM agents with their current status
- Which project mode each PM is currently loaded with
- A **project mode selector** — dropdown/grid showing all 10 project modes
- Click a mode to see its details (team composition, architecture template, etc.)
- **Assign a PM to a new project**: select PM → select project mode → PM activates

#### Worker Agent Pool

A pool view showing all worker agents:
- **Free Pool** section — all unassigned workers, ready to be picked
- **Assigned** section — grouped by project, showing which department each worker is in
- **Department filter** — filter view by department to see who's doing what
- Visual indicators for which AI model each worker is running

#### R&D Agent Panel

Separate panel for R&D agents:
- Each division shown with its schedule, last run time, next run time
- Status indicators (running / idle / error)
- Recent findings feed
- Toggle to enable/disable auto-upgrades per division

---

### 5.2 Agent Registration via CLI

Agents register themselves into the OpenClaw system through a **CLI tool**. This is how new agents join the inventory.

#### CLI Commands

```bash
# Register a new agent
openclaw register --type worker --name "Worker-Alpha-01"
openclaw register --type pm --name "PM-Lead-01"  
openclaw register --type rnd --name "RND-AI-Research-01" --division ai_ml_research

# Agent checks in (heartbeat — proves it's alive)
openclaw checkin --agent-id <id>

# Agent reports its status
openclaw status --agent-id <id>

# Agent picks up an assignment (worker agents)
openclaw accept --agent-id <id> --assignment-id <assignment_id>

# Agent reports task completion
openclaw complete --agent-id <id> --task-id <task_id>

# Agent goes offline gracefully
openclaw offline --agent-id <id>

# List all agents
openclaw inventory
openclaw inventory --type worker --status free
openclaw inventory --type pm --status assigned

# Agent loads a mode
openclaw load-mode --agent-id <id> --mode frontend
openclaw load-mode --agent-id <id> --mode webstore  # for PM agents

# Agent unloads mode (returns to free)
openclaw unload --agent-id <id>
```

#### Registration Flow

```
1. Agent process starts up
2. Calls: openclaw register --type worker --name "Worker-07"
3. Server creates agent record: { id, name, type, status: "free", mode: null, model: null, project: null }
4. Agent gets back: agent_id + auth_token
5. Agent starts heartbeat loop: openclaw checkin --agent-id <id> every 30s
6. Agent appears in Web-HQ inventory as "free"
7. When PM assigns work:
   - Server sends assignment to agent
   - Agent calls: openclaw accept --agent-id <id> --assignment-id <aid>
   - Agent calls: openclaw load-mode --agent-id <id> --mode frontend
   - Agent status changes to "assigned" in inventory
8. When project done:
   - Agent calls: openclaw unload --agent-id <id>
   - Agent status returns to "free"
```

---

### 5.3 Data Models

```
Agent {
  id: string (uuid)
  name: string
  type: "pm" | "worker" | "rnd"
  status: "free" | "assigned" | "busy" | "offline" | "error"
  current_mode: string | null       // e.g., "frontend", "webstore", "ai_ml_research"
  current_model: string | null      // e.g., "claude-sonnet-4-20250514"
  current_project: string | null    // project_id
  last_heartbeat: timestamp
  registered_at: timestamp
  metadata: {
    rnd_division: string | null     // only for R&D agents
    rnd_schedule: string | null     // cron expression
    rnd_last_run: timestamp | null
  }
}

Project {
  id: string (uuid)
  name: string
  description: string
  status: "planning" | "active" | "review" | "completed" | "archived"
  mode: string                      // PM mode ID (e.g., "webstore")
  pm_agent_id: string               // assigned PM agent
  team: [{
    agent_id: string
    department: string              // dept ID
    model: string                   // AI model
    assigned_at: timestamp
  }]
  tasks: [{
    id: string
    title: string
    department: string
    status: "todo" | "in_progress" | "review" | "done"
    assigned_agent_id: string | null
  }]
  budget: number | null
  spend: number                     // accumulated API cost
  created_at: timestamp
  completed_at: timestamp | null
}

Assignment {
  id: string (uuid)
  project_id: string
  agent_id: string
  department: string
  model: string
  status: "pending" | "accepted" | "active" | "completed" | "cancelled"
  created_at: timestamp
}

Preset {
  id: string
  type: "pm_mode" | "worker_dept"
  name: string
  content: string                   // the .md file content
  version: number
  last_updated_by: string           // "human" | rnd_agent_id
  updated_at: timestamp
}

Message {
  id: string (uuid)
  channel: "project_chat" | "pm_dm" | "internal_bus" | "rnd_feed" | "system_alerts"
  project_id: string | null
  sender_agent_id: string | null
  sender_name: string
  content: string
  timestamp: timestamp
  metadata: {
    mirrored_from: string | null    // if mirrored from internal bus
  }
}
```

---

### 5.4 API Endpoints

```
# ─── Agent Management ───
POST   /api/agents/register          # Register new agent
POST   /api/agents/:id/checkin       # Heartbeat
GET    /api/agents                    # List all agents (filterable by type, status)
GET    /api/agents/:id               # Get agent details
PATCH  /api/agents/:id               # Update agent (status, mode, model)
DELETE /api/agents/:id               # Deregister agent

# ─── Project Management ───
POST   /api/projects                  # Create new project
GET    /api/projects                  # List projects
GET    /api/projects/:id              # Get project with team and tasks
PATCH  /api/projects/:id              # Update project
POST   /api/projects/:id/assign-pm    # Assign PM agent to project
POST   /api/projects/:id/assign-worker # Add worker to project team

# ─── Assignments ───
POST   /api/assignments               # Create assignment (PM assigns worker)
GET    /api/assignments/:id           # Get assignment
PATCH  /api/assignments/:id           # Update (accept, complete, cancel)

# ─── Presets ───
GET    /api/presets                    # List all presets
GET    /api/presets/:id               # Get preset content
PUT    /api/presets/:id               # Update preset (with versioning)
GET    /api/presets/:id/history       # Version history

# ─── Communication ───
POST   /api/messages                  # Send message to channel
GET    /api/messages?channel=X&project=Y  # Get messages (with filters)
WS     /ws/chat/:project_id          # WebSocket for real-time project chat
WS     /ws/inventory                  # WebSocket for real-time inventory updates

# ─── Dashboard ───
GET    /api/dashboard/stats           # System-wide stats
GET    /api/dashboard/costs           # Cost breakdown
GET    /api/dashboard/health          # Agent health overview
```

---

### 5.5 Tech Stack

```
Frontend:
- React 18+ with TypeScript
- Tailwind CSS for styling
- @dnd-kit/core for drag-and-drop (agent inventory)
- Socket.io-client for real-time updates
- Zustand for state management
- React Router for navigation

Backend:
- Node.js with Express (or Fastify)
- TypeScript
- Socket.io for WebSocket
- PostgreSQL for persistence
- Prisma ORM
- Redis for caching + pub/sub (agent heartbeats, real-time events)

CLI:
- Node.js CLI with Commander.js
- Communicates with backend via REST API
- Config stored in ~/.openclaw/config.json

Presets:
- Stored as .md files in /presets/pm_modes/ and /presets/departments/
- Also persisted in DB with versioning
- CLI can sync presets: openclaw sync-presets
```

---

### 5.6 Folder Structure

```
openclaw/
├── apps/
│   ├── web/                         # React frontend (Web-HQ)
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── inventory/       # Agent inventory with drag-and-drop
│   │   │   │   │   ├── AgentCard.tsx
│   │   │   │   │   ├── FreePool.tsx
│   │   │   │   │   ├── ProjectSlots.tsx
│   │   │   │   │   ├── PMInventory.tsx
│   │   │   │   │   ├── WorkerPool.tsx
│   │   │   │   │   ├── RNDPanel.tsx
│   │   │   │   │   └── DragDropContext.tsx
│   │   │   │   ├── projects/
│   │   │   │   │   ├── ProjectBoard.tsx
│   │   │   │   │   ├── ProjectCreate.tsx
│   │   │   │   │   └── TaskKanban.tsx
│   │   │   │   ├── chat/
│   │   │   │   │   ├── ProjectChat.tsx
│   │   │   │   │   ├── PMDMHotline.tsx
│   │   │   │   │   └── RNDFeed.tsx
│   │   │   │   ├── presets/
│   │   │   │   │   ├── PresetEditor.tsx
│   │   │   │   │   └── PresetBrowser.tsx
│   │   │   │   ├── dashboard/
│   │   │   │   │   ├── CostMonitor.tsx
│   │   │   │   │   └── SystemHealth.tsx
│   │   │   │   └── shared/
│   │   │   │       ├── Badge.tsx
│   │   │   │       ├── StatusDot.tsx
│   │   │   │       └── ModelSelector.tsx
│   │   │   ├── stores/
│   │   │   │   ├── agentStore.ts
│   │   │   │   ├── projectStore.ts
│   │   │   │   └── chatStore.ts
│   │   │   ├── hooks/
│   │   │   │   ├── useWebSocket.ts
│   │   │   │   ├── useDragDrop.ts
│   │   │   │   └── useAgents.ts
│   │   │   ├── types/
│   │   │   │   └── index.ts
│   │   │   └── App.tsx
│   │   └── package.json
│   │
│   └── api/                          # Node.js backend
│       ├── src/
│       │   ├── routes/
│       │   │   ├── agents.ts
│       │   │   ├── projects.ts
│       │   │   ├── assignments.ts
│       │   │   ├── presets.ts
│       │   │   ├── messages.ts
│       │   │   └── dashboard.ts
│       │   ├── services/
│       │   │   ├── agentService.ts
│       │   │   ├── projectService.ts
│       │   │   ├── assignmentService.ts
│       │   │   ├── presetService.ts
│       │   │   └── heartbeatService.ts
│       │   ├── websocket/
│       │   │   ├── chatHandler.ts
│       │   │   └── inventoryHandler.ts
│       │   ├── middleware/
│       │   │   ├── auth.ts
│       │   │   └── agentAuth.ts
│       │   ├── prisma/
│       │   │   └── schema.prisma
│       │   └── server.ts
│       └── package.json
│
├── packages/
│   ├── cli/                          # CLI tool
│   │   ├── src/
│   │   │   ├── commands/
│   │   │   │   ├── register.ts
│   │   │   │   ├── checkin.ts
│   │   │   │   ├── status.ts
│   │   │   │   ├── accept.ts
│   │   │   │   ├── complete.ts
│   │   │   │   ├── loadMode.ts
│   │   │   │   ├── unload.ts
│   │   │   │   ├── inventory.ts
│   │   │   │   └── offline.ts
│   │   │   ├── utils/
│   │   │   │   ├── api.ts            # HTTP client for backend
│   │   │   │   └── config.ts         # ~/.openclaw/config.json handler
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── shared/                       # Shared types & constants
│       ├── types.ts
│       ├── departments.ts            # Department IDs, names, metadata
│       ├── pmModes.ts                # PM mode IDs, names, metadata
│       └── rndDivisions.ts           # R&D division definitions
│
├── presets/
│   ├── pm_modes/                     # PM project mode presets
│   │   ├── webstore.md
│   │   ├── saas.md
│   │   ├── mobile_app.md
│   │   ├── data_pipeline.md
│   │   ├── ai_ml_product.md
│   │   ├── api_platform.md
│   │   ├── cms.md
│   │   ├── internal_tools.md
│   │   ├── gaming.md
│   │   └── iot_system.md
│   │
│   ├── departments/                  # Worker department presets
│   │   ├── frontend.md
│   │   ├── backend.md
│   │   ├── devops.md
│   │   ├── database.md
│   │   ├── mobile.md
│   │   ├── security.md
│   │   ├── qa.md
│   │   ├── uiux.md
│   │   ├── data_engineering.md
│   │   ├── ml_engineering.md
│   │   ├── api_integration.md
│   │   ├── performance.md
│   │   ├── content_docs.md
│   │   └── release_eng.md
│   │
│   └── rnd/                          # R&D division presets
│       ├── ai_ml_research.md
│       ├── tech_frameworks.md
│       ├── security_intel.md
│       ├── oss_scout.md
│       ├── tooling_infra.md
│       └── competitive_intel.md
│
├── docker-compose.yml                # PostgreSQL + Redis + App
├── turbo.json                        # Turborepo config
├── package.json                      # Root workspace
└── README.md
```

---

## 6. DRAG-AND-DROP AGENT INVENTORY — DETAILED UX SPEC

This is the **most important UI component**. Here's exactly how it should work:

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│  OPENCLAW WEB-HQ                              [user] [gear] │
├──────┬──────────────────────────────────────────────────────┤
│      │                                                      │
│ NAV  │  AGENT INVENTORY                                     │
│      │                                                      │
│ ◈ Inv│  ┌─── FREE POOL (drag agents from here) ──────────┐ │
│ ◉ Prj│  │  [W-01]  [W-02]  [W-03]  [W-04]  [W-05] ...   │ │
│ 💬 Chat│  │  [PM-01] [PM-02]                                │ │
│ 📡 R&D│  └───────────────────────────────────────────────────┘ │
│ $ Cost│                                                      │
│ ⚙ Set│  ┌─── ACTIVE PROJECTS (drag agents here) ─────────┐ │
│      │  │                                                  │ │
│      │  │  ┌── Project: "Acme Web Store" ──────────────┐  │ │
│      │  │  │  PM: [PM-01 🛒 WebStore]                   │  │ │
│      │  │  │  Workers:                                   │  │ │
│      │  │  │  [W-01 ◧ Frontend] [W-02 ◨ Backend]       │  │ │
│      │  │  │  [W-03 ◫ Database] [W-04 ◩ DevOps]        │  │ │
│      │  │  │  [ + drop worker here ]                     │  │ │
│      │  │  └─────────────────────────────────────────────┘  │ │
│      │  │                                                  │ │
│      │  │  ┌── Project: "Internal Dashboard" ──────────┐  │ │
│      │  │  │  PM: [PM-02 🔧 Internal]                   │  │ │
│      │  │  │  Workers:                                   │  │ │
│      │  │  │  [W-05 ◧ Frontend] [W-06 ◨ Backend]       │  │ │
│      │  │  │  [ + drop worker here ]                     │  │ │
│      │  │  └─────────────────────────────────────────────┘  │ │
│      │  └──────────────────────────────────────────────────┘ │
│      │                                                      │
│      │  ┌─── R&D AGENTS (always-on panel) ────────────────┐ │
│      │  │  [⟐ AI Research 🟢] [⟑ Tech News 🟢]           │ │
│      │  │  [⟒ Security 🟢]    [⟓ OSS Scout 🟡]           │ │
│      │  └──────────────────────────────────────────────────┘ │
└──────┴──────────────────────────────────────────────────────┘
```

### Drag-and-Drop Interactions

1. **Drag worker from Free Pool → Project drop zone**:
   - Drop triggers modal: "Assign [Agent Name] to [Project Name]"
   - Modal shows: Department selector (grid of 14 depts) + Model selector dropdown
   - On confirm: agent moves to project, loads mode, status = assigned

2. **Drag worker from Project → Free Pool**:
   - Confirmation: "Release [Agent] from [Project]? They will unload [Department] mode."
   - On confirm: agent unloads, returns to free pool

3. **Drag worker from Project A → Project B**:
   - Confirmation + new department/model selector
   - Agent unloads old mode, loads new mode for new project

4. **Drag PM to Project header**:
   - Shows project mode selector first
   - Then assigns PM to project with selected mode

5. **Agent cards show**:
   - Color-coded border by department (each dept has unique color)
   - Status dot (green=active, yellow=busy, gray=free, red=error)
   - Department icon when assigned
   - Small model badge (e.g., "S" for Sonnet, "H" for Haiku)
   - Tooltip on hover with full details

### Agent Card Component

```
┌──────────────────────┐
│ ◧ W-01               │  ← dept icon + agent ID
│ Frontend UI           │  ← department name (when assigned)
│ claude-sonnet  🟢     │  ← model + status dot
│ Project: Acme Store   │  ← current project (when assigned)
└──────────────────────┘
```

When in Free Pool:
```
┌──────────────────────┐
│ ○ W-01               │  ← empty icon + agent ID
│ FREE                  │  ← status
│ ⠿ drag to assign      │  ← drag hint
└──────────────────────┘
```

---

## 7. IMPLEMENTATION PRIORITY

Build in this order:

### Phase 1: Foundation
1. Database schema + migrations (Prisma)
2. Backend API — agent CRUD + project CRUD
3. CLI — register, checkin, inventory commands
4. Basic frontend — agent list view (no drag-drop yet)

### Phase 2: Core Inventory
5. Drag-and-drop agent inventory UI
6. PM mode selector + assignment flow
7. Worker assignment flow (dept + model selection)
8. Real-time updates via WebSocket (agent status changes appear instantly)

### Phase 3: Communication
9. Project Chat (with WebSocket)
10. PM DM Hotline
11. Internal Agent Bus (agent-to-agent, mirrored to chat)
12. R&D Feed

### Phase 4: Management
13. Preset editor (view + edit .md files)
14. Cost monitor dashboard
15. System health / agent heartbeat monitoring
16. R&D control panel

### Phase 5: Presets
17. Write all 10 PM mode preset .md files
18. Write all 14 worker department preset .md files
19. Write all 6 R&D division preset .md files
20. Preset sync between filesystem and database

---

## 8. CRITICAL IMPLEMENTATION NOTES

- **Real-time is essential**: Agent inventory MUST update in real-time. When an agent registers via CLI or gets assigned, every user looking at Web-HQ should see the change instantly. Use WebSocket + Redis pub/sub.

- **Drag-and-drop must feel native**: Use @dnd-kit/core. Smooth animations. Visual feedback during drag (ghost card, valid/invalid drop zones highlighted). Snap-to behavior.

- **Agent heartbeats**: Every agent sends a heartbeat every 30 seconds. If no heartbeat for 90 seconds, mark as `offline`. If offline for 5 minutes, show warning in System Alerts.

- **Mode loading is a state change**: When a worker "loads a mode", it's just updating their `current_mode` and `current_model` fields. The actual `.md` content gets sent to the agent via the next API call/message. The mode file is their system prompt.

- **Presets are versioned**: Every edit to a preset creates a new version. R&D proposed changes create a "pending" version that needs human approval.

- **PM sub-agents are ephemeral**: They spawn, do their task, return results, and die. They don't appear in the inventory. They're just API calls the PM makes.

- **Cost tracking**: Every API call from every agent should be logged with token counts and cost. Sum up per project, per agent, per model for the cost dashboard.

---

## 9. ENVIRONMENT & CONFIG

```env
# .env
DATABASE_URL=postgresql://openclaw:password@localhost:5432/openclaw
REDIS_URL=redis://localhost:6379
API_PORT=3001
WEB_PORT=3000
JWT_SECRET=<random>
ANTHROPIC_API_KEY=<key>           # for future agent API calls
OPENAI_API_KEY=<key>              # for future agent API calls
```

```json
// ~/.openclaw/config.json (CLI config, created on first register)
{
  "server_url": "http://localhost:3001",
  "agent_id": "uuid-here",
  "agent_token": "jwt-token-here",
  "agent_type": "worker",
  "agent_name": "Worker-Alpha-01"
}
```

---

**END OF SPECIFICATION. Implement this system. Start with Phase 1.**
