import { useState, useEffect, useCallback } from 'react';
import {
  Server, Cpu, Activity, RefreshCw, Loader2, Bot, Wifi, WifiOff,
  Clock, Zap, AlertTriangle, CheckCircle, ArrowRight, Trash2, Play
} from 'lucide-react';
import { machinesApi, agentsApi, invalidateCache } from '../services/api';
import { toast } from '../components/Toast';

const M: React.CSSProperties = { fontFamily: 'var(--font-mono)' };

interface FleetMachine {
  id: string;
  hostname: string;
  ip_address: string | null;
  status: string;
  health: 'online' | 'idle' | 'offline';
  last_seen: string | null;
  last_seen_ago_ms: number | null;
  metadata: Record<string, any>;
  agents_running: number;
  capacity: number;
  load_pct: number;
  agents: Array<{
    agent_id: string;
    agent_name: string;
    handle: string;
    agent_status: string;
    agent_type: string;
    started_at: string;
  }>;
  created_at: string;
}

interface FleetSummary {
  total_machines: number;
  online: number;
  idle: number;
  offline: number;
  total_agents_running: number;
  total_capacity: number;
  fleet_load_pct: number;
}

interface Agent {
  id: string;
  name: string;
  handle: string;
  status: string;
  agent_type: string;
  is_approved: boolean;
}

const HEALTH_CONFIG = {
  online:  { color: '#4ade80', bg: 'rgba(74,222,128,0.12)', label: 'ONLINE', icon: Wifi },
  idle:    { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', label: 'IDLE', icon: Clock },
  offline: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', label: 'OFFLINE', icon: WifiOff },
};

function timeAgo(ms: number | null) {
  if (ms === null) return 'Never';
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function LoadBar({ value, max, color = 'var(--cyan)' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  const barColor = pct > 80 ? '#ef4444' : pct > 60 ? '#f59e0b' : color;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--ink-4)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: barColor, borderRadius: 3, transition: 'width 0.3s' }} />
      </div>
      <span style={{ ...M, fontSize: 10, color: 'var(--text-lo)', minWidth: 40, textAlign: 'right' }}>
        {value}/{max}
      </span>
    </div>
  );
}

export default function Fleet() {
  const [fleet, setFleet] = useState<FleetMachine[]>([]);
  const [summary, setSummary] = useState<FleetSummary | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState('');

  const load = useCallback(async () => {
    try {
      const [healthData, agentData] = await Promise.all([
        machinesApi.health(),
        agentsApi.list(),
      ]);
      setFleet(healthData.fleet || []);
      setSummary(healthData.summary || null);
      setAgents((agentData.agents || []).filter((a: Agent) => a.is_approved));
    } catch (err) {
      console.error('Fleet load failed:', err);
      toast.error('Fleet', 'Failed to load fleet data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(() => {
      invalidateCache('/api/machines');
      load();
    }, 15000);
    return () => clearInterval(interval);
  }, [load]);

  const handleAutoAssign = async () => {
    if (!selectedAgent) return;
    setAssigning(selectedAgent);
    try {
      const result = await machinesApi.autoAssign(selectedAgent);
      if (result.already_running) {
        toast.info('Fleet', `Agent already running on ${result.hostname}`);
      } else {
        toast.success('Fleet', `Agent assigned to ${result.hostname} (${result.machine_load})`);
      }
      invalidateCache('/api/machines');
      setSelectedAgent('');
      await load();
    } catch (err: any) {
      toast.error('Fleet', err.message || 'Auto-assign failed');
    } finally {
      setAssigning(null);
    }
  };

  const handleUnlink = async (machineId: string, agentId: string, agentName: string) => {
    try {
      await machinesApi.unlinkAgent(machineId, agentId);
      toast.success('Fleet', `${agentName} stopped`);
      invalidateCache('/api/machines');
      await load();
    } catch (err: any) {
      toast.error('Fleet', err.message || 'Failed to stop agent');
    }
  };

  const handleDelete = async (id: string, hostname: string) => {
    if (!confirm(`Delete machine ${hostname}?`)) return;
    try {
      await machinesApi.delete(id);
      toast.success('Fleet', `${hostname} removed`);
      invalidateCache('/api/machines');
      await load();
    } catch (err: any) {
      toast.error('Fleet', err.message || 'Failed to delete machine');
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh' }}>
        <Loader2 size={18} style={{ color: 'var(--cyan)', animation: 'spin 1s linear infinite' }} />
        <span style={{ ...M, fontSize: 11, color: 'var(--text-lo)', marginLeft: 8, letterSpacing: '0.1em' }}>LOADING FLEET...</span>
      </div>
    );
  }

  // Agents not currently assigned to any machine
  const runningAgentIds = new Set(fleet.flatMap(m => m.agents.map(a => a.agent_id)));
  const unassignedAgents = agents.filter(a => !runningAgentIds.has(a.id));

  return (
    <div style={{ ...M, padding: '16px 20px', maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Server size={16} style={{ color: 'var(--cyan)' }} />
          <h1 style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-hi)', margin: 0 }}>
            FLEET MONITOR
          </h1>
        </div>
        <button onClick={() => { invalidateCache('/api/machines'); load(); }}
          style={{ ...M, display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', fontSize: 10,
            background: 'var(--ink-3)', border: '1px solid var(--ink-5)', borderRadius: 3,
            color: 'var(--text-lo)', cursor: 'pointer' }}>
          <RefreshCw size={10} /> REFRESH
        </button>
      </div>

      {/* Summary cards */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'MACHINES', value: summary.total_machines, color: 'var(--cyan)' },
            { label: 'ONLINE', value: summary.online, color: '#4ade80' },
            { label: 'AGENTS RUNNING', value: summary.total_agents_running, color: '#a78bfa' },
            { label: 'TOTAL CAPACITY', value: summary.total_capacity, color: '#f59e0b' },
            { label: 'FLEET LOAD', value: `${summary.fleet_load_pct}%`, color: summary.fleet_load_pct > 80 ? '#ef4444' : summary.fleet_load_pct > 50 ? '#f59e0b' : '#4ade80' },
          ].map(s => (
            <div key={s.label} style={{
              padding: '12px 14px', borderRadius: 6, background: 'var(--ink-2)',
              border: '1px solid var(--ink-4)',
            }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 8, color: 'var(--text-lo)', letterSpacing: '0.1em', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Auto-assign section */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20,
        padding: '12px 14px', borderRadius: 6, background: 'var(--ink-2)', border: '1px solid var(--ink-4)',
      }}>
        <Zap size={14} style={{ color: 'var(--amber)', flexShrink: 0 }} />
        <span style={{ fontSize: 10, color: 'var(--text-lo)', letterSpacing: '0.1em', flexShrink: 0 }}>LOAD BALANCER</span>
        <select
          value={selectedAgent}
          onChange={e => setSelectedAgent(e.target.value)}
          style={{
            ...M, flex: 1, fontSize: 11, padding: '6px 8px', background: 'var(--ink-1)',
            border: '1px solid var(--ink-4)', borderRadius: 3, color: 'var(--text-hi)',
          }}
        >
          <option value="">Select agent to auto-assign...</option>
          {unassignedAgents.map(a => (
            <option key={a.id} value={a.id}>{a.name} ({a.agent_type || 'worker'}) — {a.status}</option>
          ))}
        </select>
        <button
          onClick={handleAutoAssign}
          disabled={!selectedAgent || !!assigning}
          style={{
            ...M, display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', fontSize: 10,
            background: selectedAgent ? 'var(--amber)' : 'var(--ink-4)',
            color: selectedAgent ? '#000' : 'var(--text-lo)',
            border: 'none', borderRadius: 3, cursor: selectedAgent ? 'pointer' : 'default',
            fontWeight: 700, letterSpacing: '0.05em',
          }}
        >
          {assigning ? <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={10} />}
          AUTO-ASSIGN
        </button>
      </div>

      {/* Fleet grid */}
      {fleet.length === 0 ? (
        <div style={{
          padding: 40, textAlign: 'center', borderRadius: 6,
          background: 'var(--ink-2)', border: '1px solid var(--ink-4)',
        }}>
          <Server size={28} style={{ color: 'var(--text-lo)', marginBottom: 8 }} />
          <div style={{ fontSize: 12, color: 'var(--text-lo)' }}>No machines registered</div>
          <div style={{ fontSize: 10, color: 'var(--text-lo)', marginTop: 4 }}>
            Register machines via POST /api/machines/register
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {fleet.map(machine => {
            const hc = HEALTH_CONFIG[machine.health];
            const HealthIcon = hc.icon;
            return (
              <div key={machine.id} style={{
                borderRadius: 6, background: 'var(--ink-2)', border: '1px solid var(--ink-4)',
                borderLeft: `3px solid ${hc.color}`, overflow: 'hidden',
              }}>
                {/* Machine header */}
                <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 6, background: hc.bg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <HealthIcon size={18} style={{ color: hc.color }} />
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-hi)' }}>{machine.hostname}</span>
                      <span style={{
                        fontSize: 8, fontWeight: 700, padding: '2px 6px', borderRadius: 2,
                        background: hc.bg, color: hc.color, letterSpacing: '0.1em',
                      }}>
                        {hc.label}
                      </span>
                      {machine.ip_address && (
                        <span style={{ fontSize: 10, color: 'var(--text-lo)' }}>{machine.ip_address}</span>
                      )}
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--text-lo)', marginTop: 2 }}>
                      Last seen: {timeAgo(machine.last_seen_ago_ms)}
                      {machine.metadata.os && <> | {machine.metadata.os}</>}
                      {machine.metadata.cpu && <> | {machine.metadata.cpu}</>}
                    </div>
                  </div>

                  {/* Load indicator */}
                  <div style={{ width: 120 }}>
                    <div style={{ fontSize: 9, color: 'var(--text-lo)', marginBottom: 3, display: 'flex', justifyContent: 'space-between' }}>
                      <span>LOAD</span>
                      <span style={{ color: machine.load_pct > 80 ? '#ef4444' : machine.load_pct > 50 ? '#f59e0b' : '#4ade80' }}>
                        {machine.load_pct}%
                      </span>
                    </div>
                    <LoadBar value={machine.agents_running} max={machine.capacity} />
                  </div>

                  <button onClick={() => handleDelete(machine.id, machine.hostname)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-lo)' }}
                    title="Delete machine">
                    <Trash2 size={12} />
                  </button>
                </div>

                {/* Running agents */}
                {machine.agents.length > 0 && (
                  <div style={{ borderTop: '1px solid var(--ink-4)', padding: '8px 14px' }}>
                    <div style={{ fontSize: 8, color: 'var(--text-lo)', letterSpacing: '0.1em', marginBottom: 6 }}>
                      RUNNING AGENTS ({machine.agents.length})
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {machine.agents.map(a => (
                        <div key={a.agent_id} style={{
                          display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px',
                          borderRadius: 3, background: 'var(--ink-3)', border: '1px solid var(--ink-5)',
                        }}>
                          <Bot size={10} style={{ color: '#a78bfa' }} />
                          <span style={{ fontSize: 10, color: 'var(--text-hi)' }}>{a.agent_name || a.handle}</span>
                          {a.agent_type && (
                            <span style={{ fontSize: 8, color: 'var(--text-lo)', textTransform: 'uppercase' }}>{a.agent_type}</span>
                          )}
                          <button
                            onClick={() => handleUnlink(machine.id, a.agent_id, a.agent_name || a.handle)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#ef4444', fontSize: 10 }}
                            title="Stop agent on this machine"
                          >
                            x
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
