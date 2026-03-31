import { useState, useEffect, useCallback, useRef } from 'react';
import { rndApi, wsClient } from '../services/api';
import type { RndAgent, RndFinding } from '../services/api';
import { FlaskConical, Loader2, RefreshCw, Play, Clock, ChevronDown, ChevronRight, Zap, Activity } from 'lucide-react';

const SCHEDULE_OPTIONS = [
  { value: 'every_4h', label: 'Every 4h' },
  { value: 'every_6h', label: 'Every 6h' },
  { value: 'daily',    label: 'Daily' },
  { value: 'weekly',   label: 'Weekly' },
];

const IMPACT_STYLE: Record<string, { color: string; bg: string }> = {
  low:      { color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
  medium:   { color: '#faa81a', bg: 'rgba(250,168,26,0.1)' },
  high:     { color: '#f97316', bg: 'rgba(249,115,22,0.1)' },
  critical: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)'  },
};

const DIVISION_COLOR: Record<string, string> = {
  ai_ml_research:     '#818cf8',
  security_research:  '#f87171',
  market_research:    '#34d399',
  product_research:   '#60a5fa',
  general_research:   '#94a3b8',
};

function timeAgo(ts: string | null): string {
  if (!ts) return 'never';
  const diff = Date.now() - new Date(ts).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export default function RndPanel() {
  const mono: React.CSSProperties = { fontFamily: 'var(--font-mono)' };

  const [agents, setAgents]       = useState<RndAgent[]>([]);
  const [feed, setFeed]           = useState<RndFinding[]>([]);
  const [loading, setLoading]     = useState(true);
  const [executing, setExecuting] = useState<string | null>(null);
  const [expanded, setExpanded]   = useState<Set<string>>(new Set());
  const [liveOutput, setLiveOutput] = useState<Record<string, string>>({});
  const feedRef = useRef<HTMLDivElement>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [statusRes, feedRes] = await Promise.allSettled([
        rndApi.getStatus(),
        rndApi.getFeed(),
      ]);
      if (statusRes.status === 'fulfilled') setAgents(statusRes.value.agents || []);
      if (feedRes.status  === 'fulfilled') setFeed(feedRes.value.messages   || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Live updates when finding posted
  useEffect(() => {
    const onFinding = () => {
      rndApi.getFeed().then(r => setFeed(r.messages || [])).catch(() => {});
      rndApi.getStatus().then(r => setAgents(r.agents || [])).catch(() => {});
    };
    wsClient.on('rnd:findings_posted', onFinding);
    return () => wsClient.off('rnd:findings_posted', onFinding);
  }, []);

  // Auto-refresh feed every 30s
  useEffect(() => {
    const t = setInterval(() => {
      rndApi.getFeed().then(r => setFeed(r.messages || [])).catch(() => {});
    }, 30000);
    return () => clearInterval(t);
  }, []);

  const handleExecute = async (agentId: string) => {
    setExecuting(agentId);
    setLiveOutput(prev => ({ ...prev, [agentId]: '' }));
    try {
      const res = await rndApi.execute(agentId);
      setLiveOutput(prev => ({ ...prev, [agentId]: `✓ Complete — impact: ${res.impact_level}` }));
      const [statusRes, feedRes] = await Promise.allSettled([
        rndApi.getStatus(),
        rndApi.getFeed(),
      ]);
      if (statusRes.status === 'fulfilled') setAgents(statusRes.value.agents || []);
      if (feedRes.status  === 'fulfilled') setFeed(feedRes.value.messages   || []);
    } catch (e: any) {
      setLiveOutput(prev => ({ ...prev, [agentId]: `✗ ${e.message || 'failed'}` }));
    } finally {
      setExecuting(null);
    }
  };

  const handleScheduleChange = async (agentId: string, schedule: string) => {
    try {
      await rndApi.updateSchedule(agentId, schedule);
      setAgents(prev => prev.map(a => a.id === agentId ? { ...a, rnd_schedule: schedule } : a));
    } catch { /* ignore */ }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64 gap-3">
      <Loader2 size={14} className="animate-spin" style={{ color: 'var(--amber)' }} />
      <span style={{ ...mono, fontSize: 11, color: 'var(--text-lo)' }}>LOADING R&D...</span>
    </div>
  );

  return (
    <div className="space-y-8 animate-fade-up">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FlaskConical size={16} style={{ color: '#818cf8' }} />
          <span style={{ ...mono, fontSize: 14, fontWeight: 700, color: 'var(--text-hi)', letterSpacing: '-0.01em' }}>R&D CONTROL</span>
          <span style={{ ...mono, fontSize: 10, color: 'var(--text-lo)', background: 'var(--ink-3)', border: '1px solid var(--ink-4)', borderRadius: 2, padding: '2px 7px' }}>{agents.length} AGENTS</span>
        </div>
        <button onClick={fetchAll} style={{ ...mono, fontSize: 10, color: 'var(--text-lo)', background: 'var(--ink-2)', border: '1px solid var(--ink-4)', borderRadius: 2, padding: '5px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
          <RefreshCw size={10} /> REFRESH
        </button>
      </div>

      {/* Agents grid */}
      <section>
        <div style={{ ...mono, fontSize: 10, letterSpacing: '0.1em', color: 'var(--text-lo)', marginBottom: 12 }}>RESEARCH AGENTS</div>
        {agents.length === 0 ? (
          <div className="ops-panel" style={{ padding: '32px 16px', textAlign: 'center' }}>
            <span style={{ ...mono, fontSize: 11, color: 'var(--text-lo)', opacity: 0.5 }}>No R&D agents registered. Start one with <code>--type rnd --division ai_ml_research</code></span>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {agents.map(agent => {
              const divColor = DIVISION_COLOR[agent.rnd_division] || '#94a3b8';
              const isRunning = executing === agent.id;
              const output = liveOutput[agent.id];
              return (
                <div key={agent.id} className="ops-panel" style={{ padding: '14px 16px', borderLeft: `3px solid ${divColor}` }}>
                  {/* Name + status */}
                  <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
                    <div className="flex items-center gap-2">
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: agent.status === 'online' || agent.status === 'working' ? '#10b981' : '#475569', display: 'inline-block', flexShrink: 0 }} />
                      <span style={{ ...mono, fontSize: 13, fontWeight: 700, color: 'var(--text-hi)' }}>{agent.name}</span>
                    </div>
                    <span style={{ ...mono, fontSize: 9, color: divColor, background: `${divColor}18`, border: `1px solid ${divColor}40`, borderRadius: 2, padding: '2px 6px', letterSpacing: '0.06em' }}>
                      {(agent.rnd_division || '').replace(/_/g, ' ').toUpperCase()}
                    </span>
                  </div>

                  {/* Model + last run */}
                  <div style={{ ...mono, fontSize: 10, color: 'var(--text-lo)', marginBottom: 10, display: 'flex', gap: 12 }}>
                    <span style={{ color: '#818cf8' }}>{agent.model || 'claude-code'}</span>
                    <span><Clock size={9} style={{ display: 'inline', marginRight: 3 }} />{timeAgo(agent.rnd_last_run)}</span>
                  </div>

                  {/* Schedule */}
                  <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ ...mono, fontSize: 10, color: 'var(--text-lo)' }}>SCHEDULE</span>
                    <select
                      value={agent.rnd_schedule || 'daily'}
                      onChange={e => handleScheduleChange(agent.id, e.target.value)}
                      className="ops-input"
                      style={{ ...mono, fontSize: 10, padding: '3px 6px', flex: 1 }}
                    >
                      {SCHEDULE_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    {agent.scheduled && (
                      <span style={{ ...mono, fontSize: 9, color: '#10b981' }}>● SCHED</span>
                    )}
                  </div>

                  {/* Live output while running */}
                  {output && (
                    <div style={{ ...mono, fontSize: 10, color: isRunning ? '#86efac' : '#94a3b8', background: '#050e07', border: '1px solid #1a3a1a', borderRadius: 2, padding: '7px 10px', marginBottom: 10, maxHeight: 80, overflowY: 'auto', lineHeight: 1.5 }}>
                      {output}
                    </div>
                  )}

                  {/* Run button */}
                  <button
                    onClick={() => handleExecute(agent.id)}
                    disabled={isRunning || !agent.is_approved}
                    className="ops-btn"
                    style={{ width: '100%', justifyContent: 'center', gap: 6, opacity: !agent.is_approved ? 0.4 : 1 }}
                  >
                    {isRunning ? <><Loader2 size={11} className="animate-spin" /> RUNNING...</> : <><Play size={11} /> RUN NOW</>}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Research Feed */}
      <section>
        <div style={{ ...mono, fontSize: 10, letterSpacing: '0.1em', color: 'var(--text-lo)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Activity size={11} style={{ color: '#818cf8' }} />
          RESEARCH FEED
          <span style={{ ...mono, fontSize: 9, color: 'var(--text-lo)', background: 'var(--ink-3)', border: '1px solid var(--ink-4)', borderRadius: 2, padding: '1px 6px' }}>{feed.length}</span>
        </div>

        {feed.length === 0 ? (
          <div className="ops-panel" style={{ padding: '32px 16px', textAlign: 'center' }}>
            <span style={{ ...mono, fontSize: 11, color: 'var(--text-lo)', opacity: 0.5 }}>No research findings yet. Run an agent to generate findings.</span>
          </div>
        ) : (
          <div ref={feedRef} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {feed.map(finding => {
              const impact  = finding.metadata?.impact_level || 'low';
              const style   = IMPACT_STYLE[impact] || IMPACT_STYLE.low;
              const divColor = DIVISION_COLOR[finding.rnd_division] || '#94a3b8';
              const isExp   = expanded.has(finding.id);
              const content = finding.content || '';
              const long    = content.length > 300;
              const display = isExp || !long ? content : content.slice(0, 300) + '…';

              return (
                <div key={finding.id} className="ops-panel" style={{ padding: '12px 16px', borderLeft: `3px solid ${style.color}` }}>
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                    <span style={{ ...mono, fontSize: 12, fontWeight: 700, color: 'var(--text-hi)' }}>{finding.agent_name || '?'}</span>
                    {finding.rnd_division && (
                      <span style={{ ...mono, fontSize: 9, color: divColor, background: `${divColor}18`, border: `1px solid ${divColor}40`, borderRadius: 2, padding: '2px 6px' }}>
                        {finding.rnd_division.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    )}
                    <span style={{ ...mono, fontSize: 9, color: style.color, background: style.bg, border: `1px solid ${style.color}40`, borderRadius: 2, padding: '2px 6px', textTransform: 'uppercase' }}>
                      {impact}
                    </span>
                    {finding.metadata?.skipped && (
                      <span style={{ ...mono, fontSize: 9, color: '#a78bfa', background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: 2, padding: '2px 6px' }}>SIMULATED</span>
                    )}
                    <span style={{ ...mono, fontSize: 10, color: 'var(--text-lo)', marginLeft: 'auto' }}>{timeAgo(finding.created_at)}</span>
                  </div>

                  {/* Content */}
                  <div
                    style={{ ...mono, fontSize: 11, color: 'var(--text-hi)', lineHeight: 1.65, whiteSpace: 'pre-wrap', cursor: long ? 'pointer' : 'default', marginBottom: 8 }}
                    onClick={() => long && setExpanded(prev => { const n = new Set(prev); n.has(finding.id) ? n.delete(finding.id) : n.add(finding.id); return n; })}
                  >
                    {display}
                  </div>

                  {long && (
                    <button
                      onClick={() => setExpanded(prev => { const n = new Set(prev); n.has(finding.id) ? n.delete(finding.id) : n.add(finding.id); return n; })}
                      style={{ ...mono, fontSize: 10, color: '#818cf8', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, padding: 0, marginBottom: 8 }}
                    >
                      {isExp ? <><ChevronDown size={10} /> SHOW LESS</> : <><ChevronRight size={10} /> SHOW MORE</>}
                    </button>
                  )}

                  {/* Footer */}
                  <div style={{ ...mono, fontSize: 10, color: 'var(--text-lo)', display: 'flex', gap: 14 }}>
                    <span style={{ color: '#818cf8' }}>{finding.metadata?.model || '—'}</span>
                    <span><Zap size={9} style={{ display: 'inline', marginRight: 3 }} />{((finding.metadata?.tokens?.prompt || 0) + (finding.metadata?.tokens?.completion || 0)).toLocaleString()} tok</span>
                    <span>${(finding.metadata?.cost || 0).toFixed(4)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
