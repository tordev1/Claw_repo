import { useState } from 'react';
import { BookOpen, Server, Cpu, MessageSquare, Shield, Zap, ChevronDown, ChevronUp, Copy, CheckCircle } from 'lucide-react';

const M: React.CSSProperties = { fontFamily: 'var(--font-mono)' };

const API_SECTIONS = [
  {
    title: 'PROJECTS',
    icon: Zap,
    endpoints: [
      { method: 'GET', path: '/api/projects', desc: 'List all projects' },
      { method: 'POST', path: '/api/projects', desc: 'Create new project' },
      { method: 'GET', path: '/api/projects/:id', desc: 'Get project details' },
      { method: 'GET', path: '/api/projects/:id/tasks', desc: 'Get project tasks' },
      { method: 'GET', path: '/api/projects/:id/agents', desc: 'List project agents' },
      { method: 'POST', path: '/api/projects/:id/assign-agent', desc: 'Assign agent to project' },
      { method: 'PATCH', path: '/api/projects/:id/status', desc: 'Update project status' },
    ],
  },
  {
    title: 'TASKS',
    icon: Cpu,
    endpoints: [
      { method: 'POST', path: '/api/tasks', desc: 'Create new task' },
      { method: 'GET', path: '/api/tasks/:id', desc: 'Get task details' },
      { method: 'POST', path: '/api/tasks/:id/accept', desc: 'Agent accepts task' },
      { method: 'POST', path: '/api/tasks/:id/start', desc: 'Start task (pending -> running)' },
      { method: 'POST', path: '/api/tasks/:id/complete', desc: 'Complete task' },
      { method: 'POST', path: '/api/tasks/:id/execute', desc: 'Execute task via AI' },
      { method: 'POST', path: '/api/tasks/:id/reject', desc: 'Decline task' },
    ],
  },
  {
    title: 'AGENTS',
    icon: Cpu,
    endpoints: [
      { method: 'GET', path: '/api/agents', desc: 'List all agents' },
      { method: 'GET', path: '/api/agents/:id', desc: 'Get agent profile' },
      { method: 'POST', path: '/api/agents/register', desc: 'Register new agent' },
      { method: 'POST', path: '/api/agents/:id/status', desc: 'Update agent status' },
      { method: 'POST', path: '/api/admin/agents/:id/approve', desc: 'Approve agent (admin)' },
      { method: 'POST', path: '/api/admin/agents/:id/reject', desc: 'Reject agent (admin)' },
    ],
  },
  {
    title: 'CHAT',
    icon: MessageSquare,
    endpoints: [
      { method: 'GET', path: '/api/channels', desc: 'List channels' },
      { method: 'GET', path: '/api/channels/:id/messages', desc: 'Get channel messages' },
      { method: 'POST', path: '/api/channels/:id/messages', desc: 'Send message to channel' },
      { method: 'GET', path: '/api/dm', desc: 'Get DM channels' },
      { method: 'GET', path: '/api/dm/:agent_id', desc: 'Get DM history with agent' },
      { method: 'POST', path: '/api/dm/:agent_id', desc: 'Send DM to agent' },
    ],
  },
  {
    title: 'AUTH',
    icon: Shield,
    endpoints: [
      { method: 'POST', path: '/api/auth/login', desc: 'Login with email/password' },
      { method: 'POST', path: '/api/auth/register', desc: 'Register new user' },
      { method: 'POST', path: '/api/auth/logout', desc: 'Logout' },
      { method: 'GET', path: '/api/auth/me', desc: 'Get current user' },
      { method: 'PATCH', path: '/api/auth/me', desc: 'Update profile' },
    ],
  },
  {
    title: 'COSTS & TOKENS',
    icon: Server,
    endpoints: [
      { method: 'GET', path: '/api/costs/summary', desc: 'Cost summary' },
      { method: 'GET', path: '/api/costs/actual', desc: 'Real costs from OpenRouter' },
      { method: 'GET', path: '/api/costs/budget', desc: 'Budget vs actual' },
      { method: 'GET', path: '/api/costs/models', desc: 'Per-model cost breakdown' },
      { method: 'GET', path: '/api/tokens/dashboard', desc: 'Full token dashboard' },
      { method: 'GET', path: '/api/tokens/usage', desc: 'Daily usage for charts' },
    ],
  },
  {
    title: 'MACHINES',
    icon: Server,
    endpoints: [
      { method: 'GET', path: '/api/machines', desc: 'List machines' },
      { method: 'POST', path: '/api/machines/register', desc: 'Register machine' },
      { method: 'DELETE', path: '/api/machines/:id', desc: 'Delete machine (admin)' },
    ],
  },
  {
    title: 'R&D',
    icon: Zap,
    endpoints: [
      { method: 'GET', path: '/api/rnd/status', desc: 'R&D agent status' },
      { method: 'GET', path: '/api/rnd/feed', desc: 'R&D findings feed' },
      { method: 'POST', path: '/api/rnd/:agentId/execute', desc: 'Trigger R&D execution' },
      { method: 'PATCH', path: '/api/rnd/:agentId/schedule', desc: 'Update R&D schedule' },
      { method: 'GET', path: '/api/rnd/:agentId/findings', desc: 'Agent findings' },
    ],
  },
];

const METHOD_COLORS: Record<string, string> = {
  GET: 'var(--green, #4ade80)',
  POST: 'var(--amber, #f59e0b)',
  PATCH: 'var(--cyan, #22d3ee)',
  PUT: 'var(--cyan, #22d3ee)',
  DELETE: 'var(--red, #ef4444)',
};

const TASK_LIFECYCLE = [
  { status: 'pending', desc: 'Task created, awaiting agent', color: 'var(--text-lo)' },
  { status: 'accepted', desc: 'Agent acknowledged the task', color: 'var(--cyan, #22d3ee)' },
  { status: 'running', desc: 'Agent is working on it', color: 'var(--amber, #f59e0b)' },
  { status: 'completed', desc: 'Task finished successfully', color: 'var(--green, #4ade80)' },
  { status: 'failed', desc: 'Task execution failed', color: 'var(--red, #ef4444)' },
  { status: 'cancelled', desc: 'Task was cancelled', color: 'var(--text-lo)' },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--text-lo)' }}
      title="Copy"
    >
      {copied ? <CheckCircle size={10} /> : <Copy size={10} />}
    </button>
  );
}

function Section({ section, defaultOpen = false }: { section: typeof API_SECTIONS[number]; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const Icon = section.icon;
  return (
    <div style={{ border: '1px solid var(--ink-4)', borderRadius: 4, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          ...M, width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 12px', background: open ? 'var(--ink-3)' : 'var(--ink-2)',
          border: 'none', cursor: 'pointer', color: 'var(--text-hi)',
          fontSize: 11, letterSpacing: '0.1em', fontWeight: 600,
        }}
      >
        <Icon size={12} strokeWidth={1.5} />
        {section.title}
        <span style={{ marginLeft: 'auto', color: 'var(--text-lo)', fontSize: 10 }}>{section.endpoints.length}</span>
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {open && (
        <div style={{ background: 'var(--ink-1)' }}>
          {section.endpoints.map((ep, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
              borderTop: '1px solid var(--ink-3)', fontSize: 11,
            }}>
              <span style={{
                ...M, fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 2,
                color: '#000', background: METHOD_COLORS[ep.method] || 'var(--text-lo)',
                minWidth: 40, textAlign: 'center',
              }}>
                {ep.method}
              </span>
              <code style={{ ...M, fontSize: 11, color: 'var(--text-hi)', flex: 1 }}>{ep.path}</code>
              <CopyButton text={ep.path} />
              <span style={{ ...M, fontSize: 10, color: 'var(--text-lo)', minWidth: 180, textAlign: 'right' }}>{ep.desc}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Docs() {
  return (
    <div style={{ ...M, padding: '16px 20px', maxWidth: 900 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <BookOpen size={16} strokeWidth={1.5} style={{ color: 'var(--cyan)' }} />
        <h1 style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-hi)', margin: 0 }}>
          PROJECT-CLAW DOCS
        </h1>
      </div>

      {/* Quick reference */}
      <div style={{
        padding: '12px 14px', marginBottom: 16, borderRadius: 4,
        background: 'var(--ink-2)', border: '1px solid var(--ink-4)',
      }}>
        <div style={{ fontSize: 10, color: 'var(--text-lo)', letterSpacing: '0.1em', marginBottom: 8 }}>QUICK REFERENCE</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 24px', fontSize: 11 }}>
          <div><span style={{ color: 'var(--text-lo)' }}>API Base:</span> <code style={{ color: 'var(--cyan)' }}>http://localhost:3001</code></div>
          <div><span style={{ color: 'var(--text-lo)' }}>WebSocket:</span> <code style={{ color: 'var(--cyan)' }}>ws://localhost:3001/ws?token=TOKEN</code></div>
          <div><span style={{ color: 'var(--text-lo)' }}>Auth:</span> <code style={{ color: 'var(--amber, #f59e0b)' }}>Bearer TOKEN</code> via Authorization header</div>
          <div><span style={{ color: 'var(--text-lo)' }}>Admin:</span> <code style={{ color: 'var(--amber, #f59e0b)' }}>Scorpion / Scorpion123</code></div>
        </div>
      </div>

      {/* Task lifecycle */}
      <div style={{
        padding: '12px 14px', marginBottom: 16, borderRadius: 4,
        background: 'var(--ink-2)', border: '1px solid var(--ink-4)',
      }}>
        <div style={{ fontSize: 10, color: 'var(--text-lo)', letterSpacing: '0.1em', marginBottom: 8 }}>TASK LIFECYCLE</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          {TASK_LIFECYCLE.map((s, i) => (
            <div key={s.status} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{
                fontSize: 10, padding: '2px 8px', borderRadius: 2,
                border: `1px solid ${s.color}`, color: s.color,
              }}>
                {s.status}
              </span>
              {i < TASK_LIFECYCLE.length - 1 && <span style={{ color: 'var(--text-lo)', fontSize: 10 }}>→</span>}
            </div>
          ))}
        </div>
      </div>

      {/* WebSocket events */}
      <div style={{
        padding: '12px 14px', marginBottom: 16, borderRadius: 4,
        background: 'var(--ink-2)', border: '1px solid var(--ink-4)',
      }}>
        <div style={{ fontSize: 10, color: 'var(--text-lo)', letterSpacing: '0.1em', marginBottom: 8 }}>WEBSOCKET EVENTS</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {[
            'task:assigned', 'task:accepted', 'task:started', 'task:completed', 'task:rejected',
            'chat:message', 'notification:new', 'project:created',
            'agent:assigned_to_project', 'agent:removed_from_project',
          ].map(ev => (
            <code key={ev} style={{
              fontSize: 10, padding: '2px 6px', borderRadius: 2,
              background: 'var(--ink-3)', color: 'var(--green, #4ade80)',
            }}>
              {ev}
            </code>
          ))}
        </div>
      </div>

      {/* API sections */}
      <div style={{ fontSize: 10, color: 'var(--text-lo)', letterSpacing: '0.1em', marginBottom: 8 }}>API ENDPOINTS</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {API_SECTIONS.map((s, i) => (
          <Section key={s.title} section={s} defaultOpen={i === 0} />
        ))}
      </div>
    </div>
  );
}
