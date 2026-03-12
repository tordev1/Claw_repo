import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { tasksApi, userSession } from '../services/api';
import { Loader2, ChevronLeft, ChevronDown, ChevronRight } from 'lucide-react';

const STATUS_COLOR: Record<string, string> = { pending: '#faa81a', running: '#818cf8', completed: '#10b981', failed: '#f97316', cancelled: '#ef4444' };
const PRI_COLOR: Record<string, string> = { critical: '#ef4444', high: '#f97316', medium: '#faa81a', low: '#64748b' };

function formatDate(s?: string) {
  if (!s) return '—';
  return new Date(s).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resultOpen, setResultOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const commentRef = useRef<HTMLTextAreaElement>(null);

  const user = userSession.getUser();
  const isAdmin = user?.role === 'admin';

  const mono: React.CSSProperties = { fontFamily: 'var(--font-mono)' };

  async function load() {
    if (!id) return;
    try {
      const data = await tasksApi.get(id);
      setTask(data?.task || data);
    } catch (e: any) {
      setError(e.message || 'Failed to load task');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  async function handleComment(e: React.FormEvent) {
    e.preventDefault();
    if (!comment.trim() || !id) return;
    setSubmitting(true);
    try {
      await tasksApi.addComment(id, comment.trim());
      setComment('');
      await load();
    } catch (e: any) {
      // noop — keep comment in box on error
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 gap-3">
      <Loader2 size={14} className="animate-spin" style={{ color: 'var(--amber)' }} />
      <span style={{ ...mono, fontSize: 11, color: 'var(--text-lo)' }}>LOADING TASK...</span>
    </div>
  );

  if (error || !task) return (
    <div className="flex items-center justify-center h-64">
      <span style={{ ...mono, fontSize: 12, color: '#ef4444' }}>{error || 'Task not found'}</span>
    </div>
  );

  const comments: any[] = task.comments || [];
  const history: any[] = task.assignment_history || [];
  const agent = task.agent || null;
  const result = task.result || null;
  const tags: string[] = task.tags || [];

  let resultText: string | null = null;
  if (result) {
    resultText = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
  }

  return (
    <div className="space-y-5 animate-fade-up" style={{ maxWidth: 860, margin: '0 auto' }}>
      {/* Header bar */}
      <div className="flex items-start gap-4">
        <button
          onClick={() => navigate(-1)}
          style={{ ...mono, fontSize: 10, color: 'var(--text-lo)', letterSpacing: '0.08em', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, paddingTop: 4, flexShrink: 0 }}
        >
          <ChevronLeft size={11} /> TASKS
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ ...mono, fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-hi)', marginBottom: 8 }}>{task.title}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <span style={{ ...mono, fontSize: 10, letterSpacing: '0.08em', color: STATUS_COLOR[task.status] || 'var(--text-lo)', background: 'var(--ink-3)', border: `1px solid ${STATUS_COLOR[task.status] || 'var(--ink-4)'}`, borderRadius: 2, padding: '2px 8px', textTransform: 'uppercase' }}>{task.status}</span>
            <span style={{ ...mono, fontSize: 10, letterSpacing: '0.08em', color: PRI_COLOR[task.priority] || 'var(--text-lo)', background: 'var(--ink-3)', border: `1px solid ${PRI_COLOR[task.priority] || 'var(--ink-4)'}`, borderRadius: 2, padding: '2px 8px', textTransform: 'uppercase' }}>{task.priority}</span>
            {tags.map((tag: string) => (
              <span key={tag} style={{ ...mono, fontSize: 9, color: 'var(--text-lo)', background: 'var(--ink-3)', border: '1px solid var(--ink-4)', borderRadius: 2, padding: '2px 6px' }}>{tag}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Info row */}
      <div className="flex flex-wrap gap-5" style={{ ...mono, fontSize: 11, color: 'var(--text-lo)' }}>
        {(task.project || task.project_id) && (
          <span>
            <span style={{ color: 'var(--text-lo)', opacity: 0.6, marginRight: 4 }}>PROJECT</span>
            {task.project ? (
              <Link to={`/projects/${task.project.id}`} style={{ color: 'var(--amber)', textDecoration: 'none' }}>{task.project.name}</Link>
            ) : task.project_id}
          </span>
        )}
        <span><span style={{ opacity: 0.6, marginRight: 4 }}>CREATED</span>{formatDate(task.created_at)}</span>
        {task.due_date && <span><span style={{ opacity: 0.6, marginRight: 4 }}>DUE</span>{formatDate(task.due_date)}</span>}
        {task.estimated_hours && <span><span style={{ opacity: 0.6, marginRight: 4 }}>EST</span>{task.estimated_hours}h</span>}
      </div>

      {/* Description */}
      {task.description && (
        <div className="ops-panel" style={{ padding: '14px 16px' }}>
          <div style={{ ...mono, fontSize: 10, color: 'var(--text-lo)', letterSpacing: '0.1em', marginBottom: 8 }}>DESCRIPTION</div>
          <p style={{ ...mono, fontSize: 12, color: 'var(--text-hi)', lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: 0 }}>{task.description}</p>
        </div>
      )}

      {/* Agent card */}
      <div className="ops-panel" style={{ padding: '14px 16px' }}>
        <div style={{ ...mono, fontSize: 10, color: 'var(--text-lo)', letterSpacing: '0.1em', marginBottom: 10 }}>ASSIGNED AGENT</div>
        {agent ? (
          <div className="flex items-center gap-3">
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: agent.status === 'online' ? '#10b981' : agent.status === 'busy' ? '#faa81a' : '#64748b', flexShrink: 0 }} />
            <div>
              <div style={{ ...mono, fontSize: 13, color: 'var(--text-hi)', fontWeight: 600 }}>{agent.name}</div>
              {agent.handle && <div style={{ ...mono, fontSize: 10, color: 'var(--text-lo)' }}>@{agent.handle}</div>}
            </div>
          </div>
        ) : (
          <span style={{ ...mono, fontSize: 11, color: 'var(--text-lo)', opacity: 0.6 }}>— unassigned —</span>
        )}
      </div>

      {/* AI Result */}
      {task.status === 'completed' && resultText && (
        <div className="ops-panel" style={{ padding: 0, overflow: 'hidden' }}>
          <button
            onClick={() => setResultOpen(o => !o)}
            style={{ ...mono, fontSize: 10, letterSpacing: '0.1em', color: 'var(--amber)', background: 'rgba(250,168,26,0.08)', border: 'none', borderBottom: resultOpen ? '1px solid var(--ink-4)' : 'none', cursor: 'pointer', padding: '10px 16px', width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            {resultOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            EXECUTION RESULT
          </button>
          {resultOpen && (
            <pre style={{ ...mono, fontSize: 11, color: 'var(--text-hi)', padding: '14px 16px', margin: 0, overflowX: 'auto', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{resultText}</pre>
          )}
        </div>
      )}

      {/* Comments thread */}
      <div className="ops-panel" style={{ padding: '14px 16px' }}>
        <div style={{ ...mono, fontSize: 10, color: 'var(--text-lo)', letterSpacing: '0.1em', marginBottom: 12 }}>ACTIVITY &amp; COMMENTS</div>
        {comments.length === 0 ? (
          <p style={{ ...mono, fontSize: 11, color: 'var(--text-lo)', opacity: 0.5, margin: 0 }}>— no comments yet —</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {comments.map((c: any) => (
              <div key={c.id} style={{ opacity: c.is_system ? 0.55 : 1 }}>
                {c.is_system ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ height: 1, flex: 1, background: 'var(--ink-4)' }} />
                    <span style={{ ...mono, fontSize: 10, color: 'var(--text-lo)' }}>{c.content}</span>
                    <span style={{ ...mono, fontSize: 9, color: 'var(--text-lo)', opacity: 0.6 }}>{formatDate(c.created_at)}</span>
                    <div style={{ height: 1, flex: 1, background: 'var(--ink-4)' }} />
                  </div>
                ) : (
                  <div style={{ background: 'var(--ink-2)', border: '1px solid var(--ink-4)', borderRadius: 2, padding: '10px 12px' }}>
                    <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                      <span style={{ ...mono, fontSize: 10, color: 'var(--text-hi)', fontWeight: 600 }}>{c.author_name || c.author_agent_name || 'Unknown'}</span>
                      <span style={{ ...mono, fontSize: 9, color: 'var(--text-lo)', opacity: 0.7 }}>{formatDate(c.created_at)}</span>
                    </div>
                    <p style={{ ...mono, fontSize: 11, color: 'var(--text-hi)', margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{c.content}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {isAdmin && (
          <form onSubmit={handleComment} style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <textarea
              ref={commentRef}
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Add a comment..."
              rows={3}
              className="ops-input"
              style={{ resize: 'vertical', width: '100%' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="ops-btn" disabled={submitting || !comment.trim()}>
                {submitting ? 'Posting...' : 'Post Comment'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Assignment history */}
      {history.length > 0 && (
        <div className="ops-panel" style={{ padding: 0, overflow: 'hidden' }}>
          <button
            onClick={() => setHistoryOpen(o => !o)}
            style={{ ...mono, fontSize: 10, letterSpacing: '0.1em', color: 'var(--text-lo)', background: 'none', border: 'none', cursor: 'pointer', padding: '10px 16px', width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            {historyOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            ASSIGNMENT HISTORY ({history.length})
          </button>
          {historyOpen && (
            <div style={{ borderTop: '1px solid var(--ink-4)' }}>
              {history.map((h: any, i: number) => (
                <div key={h.id || i} style={{ ...mono, fontSize: 11, color: 'var(--text-lo)', padding: '8px 16px', borderBottom: i < history.length - 1 ? '1px solid var(--ink-4)' : 'none', display: 'flex', gap: 16 }}>
                  <span style={{ color: 'var(--text-hi)' }}>{h.agent_name || h.agent_id || '—'}</span>
                  <span>assigned {formatDate(h.assigned_at)}</span>
                  {h.unassigned_at && <span>removed {formatDate(h.unassigned_at)}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
