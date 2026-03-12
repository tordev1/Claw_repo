import { useState, useEffect } from 'react';
import { X, Loader2, AlertCircle, ChevronDown } from 'lucide-react';
import { tasksApi, projectAgentsApi } from '../services/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Project { id: string; name: string }
interface AgentItem { id: string; name: string; handle: string; role?: string; agent_type?: string; status?: string }

interface Props {
  projects: Project[];
  defaultProjectId?: string;
  onClose: () => void;
  onCreated: () => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const mono: React.CSSProperties = { fontFamily: 'var(--font-mono)' };

const PRI_OPTIONS = [
  { value: 1, label: 'CRITICAL', color: '#ef4444' },
  { value: 2, label: 'HIGH',     color: '#f97316' },
  { value: 3, label: 'MEDIUM',   color: '#faa81a' },
  { value: 4, label: 'LOW',      color: '#64748b' },
] as const;

// ── Component ─────────────────────────────────────────────────────────────────

export default function TaskCreationForm({ projects, defaultProjectId, onClose, onCreated }: Props) {
  const [projectId, setProjectId] = useState(defaultProjectId || projects[0]?.id || '');
  const [title, setTitle]         = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority]   = useState<number>(3);
  const [agentId, setAgentId]     = useState('');

  const [agents, setAgents]       = useState<AgentItem[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  // Load agents whenever selected project changes
  useEffect(() => {
    if (!projectId) { setAgents([]); return; }
    setLoadingAgents(true);
    setAgentId('');
    projectAgentsApi.listByProject(projectId)
      .then(res => {
        const list: AgentItem[] = res?.agents || res || [];
        setAgents(list);
      })
      .catch(() => setAgents([]))
      .finally(() => setLoadingAgents(false));
  }, [projectId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError('Title is required'); return; }
    if (!projectId)    { setError('Select a project'); return; }

    setSubmitting(true); setError(null);
    try {
      await (tasksApi.create as any)(projectId, {
        title: title.trim(),
        description: description.trim() || undefined,
        priority: priorityLabel(priority),
        agent_id: agentId || undefined,
      });

      onCreated();
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to create task');
    } finally {
      setSubmitting(false);
    }
  };

  // Close on backdrop click
  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  // ESC key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      onClick={handleBackdrop}
      style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div style={{ background: 'var(--ink-1)', border: '1px solid var(--ink-4)', borderRadius: 4, width: '100%', maxWidth: 480, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.6)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--ink-4)' }}>
          <div>
            <div style={{ ...mono, fontSize: 9, color: 'var(--text-lo)', letterSpacing: '0.1em', marginBottom: 2 }}>TASK CENTER</div>
            <div style={{ ...mono, fontSize: 14, fontWeight: 700, color: 'var(--text-hi)', letterSpacing: '-0.01em' }}>CREATE TASK</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-lo)', padding: 4, display: 'flex' }}>
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '18px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {error && (
              <div style={{ ...mono, fontSize: 10, color: '#ef4444', background: '#ef444410', border: '1px solid #ef444430', borderRadius: 2, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertCircle size={12} /> {error}
              </div>
            )}

            {/* Project picker */}
            <div>
              <label style={{ ...mono, fontSize: 9, color: 'var(--text-lo)', letterSpacing: '0.1em', display: 'block', marginBottom: 5 }}>PROJECT *</label>
              <div style={{ position: 'relative' }}>
                <select
                  value={projectId}
                  onChange={e => setProjectId(e.target.value)}
                  disabled={submitting}
                  className="ops-input"
                  style={{ width: '100%', cursor: 'pointer', appearance: 'none', paddingRight: 30 }}
                >
                  <option value="">— select project —</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <ChevronDown size={12} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-lo)' }} />
              </div>
            </div>

            {/* Title */}
            <div>
              <label style={{ ...mono, fontSize: 9, color: 'var(--text-lo)', letterSpacing: '0.1em', display: 'block', marginBottom: 5 }}>TITLE *</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g., Implement auth middleware"
                disabled={submitting}
                autoFocus
                className="ops-input"
                style={{ width: '100%' }}
              />
            </div>

            {/* Description */}
            <div>
              <label style={{ ...mono, fontSize: 9, color: 'var(--text-lo)', letterSpacing: '0.1em', display: 'block', marginBottom: 5 }}>DESCRIPTION</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="What needs to be done..."
                rows={3}
                disabled={submitting}
                className="ops-input"
                style={{ width: '100%', resize: 'vertical', minHeight: 68 }}
              />
            </div>

            {/* Priority */}
            <div>
              <label style={{ ...mono, fontSize: 9, color: 'var(--text-lo)', letterSpacing: '0.1em', display: 'block', marginBottom: 5 }}>PRIORITY</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                {PRI_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPriority(opt.value)}
                    disabled={submitting}
                    style={{
                      ...mono, fontSize: 9, letterSpacing: '0.07em', padding: '6px 0', borderRadius: 2, cursor: 'pointer', border: `1px solid ${priority === opt.value ? opt.color : 'var(--ink-4)'}`,
                      background: priority === opt.value ? `${opt.color}18` : 'var(--ink-3)',
                      color: priority === opt.value ? opt.color : 'var(--text-lo)',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Assign to agent */}
            <div>
              <label style={{ ...mono, fontSize: 9, color: 'var(--text-lo)', letterSpacing: '0.1em', display: 'block', marginBottom: 5 }}>
                ASSIGN TO AGENT {!projectId && <span style={{ color: '#64748b' }}>(select project first)</span>}
              </label>
              {loadingAgents ? (
                <div style={{ ...mono, fontSize: 10, color: 'var(--text-lo)', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: 'var(--ink-3)', border: '1px solid var(--ink-4)', borderRadius: 2 }}>
                  <Loader2 size={10} className="animate-spin" /> loading agents...
                </div>
              ) : (
                <div style={{ position: 'relative' }}>
                  <select
                    value={agentId}
                    onChange={e => setAgentId(e.target.value)}
                    disabled={submitting || !projectId || agents.length === 0}
                    className="ops-input"
                    style={{ width: '100%', cursor: 'pointer', appearance: 'none', paddingRight: 30 }}
                  >
                    <option value="">— unassigned —</option>
                    {agents.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name} @{a.handle}{a.role ? ` · ${a.role}` : ''}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={12} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-lo)' }} />
                </div>
              )}
              {projectId && !loadingAgents && agents.length === 0 && (
                <div style={{ ...mono, fontSize: 9, color: 'var(--text-lo)', marginTop: 4 }}>No agents assigned to this project yet.</div>
              )}
            </div>

          </div>

          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--ink-4)' }}>
            <button type="button" onClick={onClose} disabled={submitting} className="ops-btn" style={{ color: 'var(--text-lo)' }}>
              CANCEL
            </button>
            <button
              type="submit"
              disabled={submitting || !title.trim() || !projectId}
              style={{
                ...mono, fontSize: 10, letterSpacing: '0.08em', padding: '7px 20px', borderRadius: 2, cursor: submitting || !title.trim() || !projectId ? 'not-allowed' : 'pointer', border: 'none',
                background: submitting || !title.trim() || !projectId ? 'var(--ink-3)' : 'var(--amber)',
                color:      submitting || !title.trim() || !projectId ? 'var(--text-lo)' : '#000',
                fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              {submitting ? <><Loader2 size={10} className="animate-spin" /> CREATING...</> : 'CREATE TASK'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function priorityLabel(n: number): string {
  return ({ 1: 'critical', 2: 'high', 3: 'medium', 4: 'low' } as Record<number, string>)[n] || 'medium';
}
