import { useState, useEffect, useCallback } from 'react';
import { Loader2, RefreshCw, FileText, Bot, FlaskConical, Cpu, ChevronRight, RotateCcw } from 'lucide-react';

const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';

async function apiFetch(path: string, opts?: RequestInit) {
  const token = localStorage.getItem('claw_token');
  const r = await fetch(API_BASE + path, {
    ...opts,
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', ...(opts?.headers || {}) },
  });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

interface PresetMeta {
  name: string;
  title: string;
  description: string;
  type: string;
}

interface PresetsData {
  pm_modes: PresetMeta[];
  departments: PresetMeta[];
  rnd_divisions: PresetMeta[];
}

const TYPE_META: Record<string, { label: string; apiType: string; icon: React.ReactNode; color: string; badge: string }> = {
  pm_modes:     { label: 'PM Modes',          apiType: 'pm_mode',      icon: <Bot size={13} />,        color: 'var(--amber)',  badge: 'PM' },
  departments:  { label: 'Worker Departments', apiType: 'worker_dept',  icon: <Cpu size={13} />,        color: '#60a5fa',      badge: 'WORKER' },
  rnd_divisions:{ label: 'R&D Divisions',      apiType: 'rnd_division', icon: <FlaskConical size={13}/>, color: 'var(--cyan)',  badge: 'R&D' },
};

export default function Presets() {
  const [data, setData] = useState<PresetsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ type: string; name: string } | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [contentLoading, setContentLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<keyof PresetsData>('pm_modes');

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      const d = await apiFetch('/api/presets');
      setData(d);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const loadContent = async (apiType: string, name: string) => {
    setContentLoading(true); setContent(null);
    try {
      const d = await apiFetch(`/api/presets/${apiType}/${name}`);
      setContent(d.content || '');
    } catch { setContent('Failed to load content.'); }
    finally { setContentLoading(false); }
  };

  const handleSelect = (meta: PresetMeta, apiType: string) => {
    setSelected({ type: apiType, name: meta.name });
    loadContent(apiType, meta.name);
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await apiFetch('/api/presets/sync', { method: 'POST' });
      await fetchAll();
    } catch {}
    finally { setSyncing(false); }
  };

  const tabs = Object.keys(TYPE_META) as (keyof PresetsData)[];
  const currentMeta = TYPE_META[activeTab];
  const items: PresetMeta[] = data?.[activeTab] || [];

  return (
    <div className="space-y-5 animate-fade-up">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="ops-section-header" style={{ marginBottom: 4 }}>Management</div>
          <h1 style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-hi)' }}>PRESET MANAGER</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSync} disabled={syncing} className="ops-btn flex items-center gap-1">
            <RotateCcw size={11} className={syncing ? 'animate-spin' : ''} /> Sync
          </button>
          <button onClick={fetchAll} disabled={loading} className="ops-btn flex items-center gap-1">
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Summary cards */}
      {data && (
        <div className="grid grid-cols-3 gap-3">
          {tabs.map(tab => {
            const m = TYPE_META[tab];
            const count = data[tab]?.length || 0;
            return (
              <div key={tab} className="ops-stat" style={{ cursor: 'pointer', border: activeTab === tab ? `1px solid ${m.color}` : undefined }}
                onClick={() => { setActiveTab(tab); setSelected(null); setContent(null); }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="ops-label">{m.label}</span>
                  <span style={{ color: m.color }}>{m.icon}</span>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 700, color: m.color }}>{count}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-lo)', marginTop: 2, letterSpacing: '0.1em' }}>PRESETS</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--ink-4)', paddingBottom: 0 }}>
        {tabs.map(tab => {
          const m = TYPE_META[tab];
          const active = activeTab === tab;
          return (
            <button key={tab} onClick={() => { setActiveTab(tab); setSelected(null); setContent(null); }}
              style={{
                fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em',
                padding: '6px 14px', background: 'none', border: 'none', cursor: 'pointer',
                color: active ? m.color : 'var(--text-lo)',
                borderBottom: active ? `2px solid ${m.color}` : '2px solid transparent',
                marginBottom: -1, transition: 'color 120ms',
              }}>
              {m.badge}
            </button>
          );
        })}
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex items-center justify-center h-40 gap-3">
          <Loader2 size={14} className="animate-spin" style={{ color: 'var(--amber)' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-lo)' }}>LOADING PRESETS...</span>
        </div>
      ) : error ? (
        <div className="ops-panel p-6 text-center">
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#ef4444' }}>ERR: {error}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* List */}
          <div className="ops-panel p-0" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--ink-4)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: currentMeta.color }}>{currentMeta.icon}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-mid)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{currentMeta.label}</span>
              <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-lo)' }}>{items.length} files</span>
            </div>
            <div style={{ overflowY: 'auto', maxHeight: 480 }}>
              {items.length === 0 ? (
                <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-lo)' }}>— no presets found —</p>
                </div>
              ) : (
                items.map(item => {
                  const isSelected = selected?.name === item.name && selected?.type === currentMeta.apiType;
                  return (
                    <div key={item.name}
                      onClick={() => handleSelect(item, currentMeta.apiType)}
                      style={{
                        padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid var(--ink-3)',
                        background: isSelected ? 'var(--ink-3)' : 'transparent',
                        borderLeft: isSelected ? `2px solid ${currentMeta.color}` : '2px solid transparent',
                        transition: 'background 100ms',
                      }}
                      onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--ink-2)'; }}
                      onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                      <div className="flex items-center justify-between">
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: isSelected ? currentMeta.color : 'var(--text-hi)', fontWeight: isSelected ? 600 : 400 }}>
                          {item.title}
                        </div>
                        {isSelected && <ChevronRight size={10} style={{ color: currentMeta.color }} />}
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-lo)', marginTop: 3, letterSpacing: '0.04em' }}>
                        {item.name}.md
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Content viewer */}
          <div className="ops-panel p-0 lg:col-span-2" style={{ overflow: 'hidden' }}>
            {!selected ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 200 }}>
                <div style={{ textAlign: 'center' }}>
                  <FileText size={24} style={{ color: 'var(--text-lo)', margin: '0 auto 10px' }} />
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-lo)' }}>Select a preset to view its content</p>
                </div>
              </div>
            ) : (
              <>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--ink-4)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.12em',
                    padding: '2px 7px', borderRadius: 2,
                    background: `${currentMeta.color}18`, color: currentMeta.color, border: `1px solid ${currentMeta.color}30`,
                    textTransform: 'uppercase',
                  }}>{currentMeta.badge}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-hi)' }}>{selected.name}.md</span>
                </div>
                <div style={{ padding: 16, overflowY: 'auto', maxHeight: 480 }}>
                  {contentLoading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 size={12} className="animate-spin" style={{ color: 'var(--text-lo)' }} />
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-lo)' }}>Loading...</span>
                    </div>
                  ) : (
                    <pre style={{
                      fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-mid)',
                      lineHeight: 1.65, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                      margin: 0,
                    }}>{content}</pre>
                  )}
                </div>
              </>
            )}
          </div>

        </div>
      )}

    </div>
  );
}
