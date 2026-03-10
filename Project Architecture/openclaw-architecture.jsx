import { useState } from "react";

// ─── THEME ───
const T = {
  bg: "#05050a", s1: "#0a0a14", s2: "#0f0f1c", s3: "#14142a",
  border: "#1a1a30", borderHi: "#2a2a48",
  pm: "#f59e0b", pmDim: "#f59e0b30", pmFaint: "#f59e0b12",
  wk: "#3b82f6", wkDim: "#3b82f630", wkFaint: "#3b82f612",
  rd: "#ef4444", rdDim: "#ef444430", rdFaint: "#ef444412",
  hq: "#10b981", hqDim: "#10b98130", hqFaint: "#10b98112",
  infra: "#8b5cf6", infraDim: "#8b5cf630",
  flow: "#22d3ee", cost: "#f472b6",
  text: "#e2e2f0", sub: "#8888a0", dim: "#555570", faint: "#2a2a3e",
  mono: "'JetBrains Mono', 'Fira Code', monospace",
  sans: "'IBM Plex Sans', system-ui, sans-serif",
};

// ─── DATA ───
const PM_MODES = [
  { id: "webstore", name: "Web Store", icon: "🛒", teams: "FE · BE · DB · DevOps · UX · QA", desc: "E-commerce: cart, checkout, payments, inventory, product catalog, search, recommendations." },
  { id: "saas", name: "SaaS Platform", icon: "☁️", teams: "FE · BE · DB · DevOps · Security · API", desc: "Multi-tenant: auth, billing, dashboards, admin, subscriptions, API layer, webhooks." },
  { id: "mobile", name: "Mobile App", icon: "📱", teams: "Mobile · BE · UX · QA · DevOps", desc: "Cross-platform: push notifs, offline sync, app store deploy, native performance." },
  { id: "datapipe", name: "Data Pipeline", icon: "🔄", teams: "DataEng · BE · DevOps · Perf", desc: "ETL/streaming: ingestion, transformation, warehousing, monitoring, alerting." },
  { id: "aiml", name: "AI/ML Product", icon: "🧠", teams: "ML · BE · DataEng · DevOps · Perf", desc: "Model serving, training pipelines, feature stores, A/B testing, GPU orchestration." },
  { id: "api", name: "API Platform", icon: "🔌", teams: "BE · API · Docs · Security · QA", desc: "Gateway, SDKs, rate limiting, versioning, developer portal, webhooks." },
  { id: "cms", name: "CMS", icon: "📝", teams: "FE · BE · DB · UX · Docs", desc: "WYSIWYG editing, media, SEO, multi-language, publishing workflows." },
  { id: "internal", name: "Internal Tools", icon: "🔧", teams: "FE · BE · DB · QA", desc: "Admin dashboards, CRUD generators, workflow automation, reporting." },
  { id: "gaming", name: "Gaming", icon: "🎮", teams: "FE · BE · Perf · DevOps · QA", desc: "Real-time multiplayer, leaderboards, matchmaking, asset pipelines." },
  { id: "iot", name: "IoT System", icon: "📡", teams: "BE · DevOps · DataEng · Security · Perf", desc: "Device management, telemetry, firmware OTA, edge computing, monitoring." },
];

const WORKER_DEPTS = [
  { id: "fe", name: "Frontend UI", icon: "◧", color: "#60a5fa" },
  { id: "be", name: "Backend", icon: "◨", color: "#34d399" },
  { id: "devops", name: "DevOps", icon: "◩", color: "#f472b6" },
  { id: "db", name: "Database", icon: "◫", color: "#a78bfa" },
  { id: "mobile", name: "Mobile Dev", icon: "◪", color: "#fb923c" },
  { id: "security", name: "Security", icon: "◬", color: "#f87171" },
  { id: "qa", name: "QA & Testing", icon: "◮", color: "#4ade80" },
  { id: "uiux", name: "UI/UX Design", icon: "◐", color: "#c084fc" },
  { id: "dataeng", name: "Data Engineering", icon: "⬢", color: "#22d3ee" },
  { id: "mleng", name: "ML Engineering", icon: "⬠", color: "#e879f9" },
  { id: "apiint", name: "API & Integration", icon: "◭", color: "#38bdf8" },
  { id: "perf", name: "Performance", icon: "◕", color: "#fbbf24" },
  { id: "docs", name: "Content & Docs", icon: "◒", color: "#86efac" },
  { id: "release", name: "Release Eng", icon: "◖", color: "#fb7185" },
];

const RND_DIVS = [
  { id: "ai", name: "AI/ML Research", icon: "⟐", schedule: "Every 6hrs", model: "Haiku", feeds: "Worker presets, Model registry", desc: "arxiv, HuggingFace, model releases → evaluates new techniques → suggests model swaps for worker agents." },
  { id: "tech", name: "Tech & Frameworks", icon: "⟑", schedule: "Daily", model: "Haiku", feeds: "Worker presets, PM modes", desc: "Framework changelogs, breaking changes, new releases → auto-updates department presets." },
  { id: "sec", name: "Security Intel", icon: "⟒", schedule: "Every 4hrs", model: "Sonnet", feeds: "Worker presets, System config", desc: "CVE monitoring, zero-days, supply chain → auto-generates patches, updates security preset." },
  { id: "oss", name: "Open Source Scout", icon: "⟓", schedule: "Daily", model: "Haiku", feeds: "Worker presets", desc: "Trending repos, new libs, license checks → recommends better alternatives." },
  { id: "tool", name: "Tooling & Infra", icon: "⟔", schedule: "Weekly", model: "Haiku", feeds: "DevOps preset, PM modes", desc: "New dev tools, CI/CD improvements, cloud services → benchmarks and upgrades." },
  { id: "comp", name: "Competitive Intel", icon: "⟕", schedule: "Weekly", model: "Haiku", feeds: "PM modes", desc: "Competitor products, pricing, features, hiring → intelligence briefs." },
];

const HQ_CHANNELS = [
  { name: "Project Chat", icon: "💬", desc: "Per-project channel. All assigned agents post here. Internal decisions mirrored for human visibility. PM is channel admin.", color: T.hq },
  { name: "PM DM Hotline", icon: "🔴", desc: "Direct message channel to any active PM agent. Available 24/7. Human override interface — priority interrupts, scope changes, emergency stops.", color: T.pm },
  { name: "Internal Agent Bus", icon: "🔗", desc: "Agent-to-agent communication. Frontend ↔ Backend negotiate API contracts. DevOps ↔ Backend coordinate deploys. Not visible to humans unless mirrored.", color: T.wk },
  { name: "R&D Feed", icon: "📡", desc: "R&D agents post discoveries, upgrade proposals, security alerts. PM agents subscribe. Auto-upgrade approvals flow through here.", color: T.rd },
  { name: "System Alerts", icon: "⚠️", desc: "Health monitoring, cost alerts, agent failures, stuck tasks. Goes to human operators and PM agents simultaneously.", color: "#fbbf24" },
];

// ─── COMPONENTS ───
const Badge = ({ children, color, filled }) => (
  <span style={{
    background: filled ? `${color}20` : "transparent",
    border: `1px solid ${color}40`,
    color, fontSize: 8, fontWeight: 700, padding: "2px 7px",
    borderRadius: 4, fontFamily: T.mono, letterSpacing: "0.08em",
  }}>{children}</span>
);

const Divider = ({ label, color = T.faint }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "32px 0 24px" }}>
    <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
    {label && <span style={{ color: T.dim, fontSize: 9, fontWeight: 700, fontFamily: T.mono, letterSpacing: "0.18em" }}>{label}</span>}
    <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
  </div>
);

const Card = ({ children, color, glow, style: sx }) => (
  <div style={{
    background: T.s2, border: `1px solid ${color || T.border}`, borderRadius: 12,
    padding: 20, position: "relative", overflow: "hidden",
    boxShadow: glow ? `0 0 40px ${color}08` : "none", ...sx,
  }}>
    {color && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${color}, transparent)` }} />}
    {children}
  </div>
);

const SectionHead = ({ num, title, sub, color }) => (
  <div style={{ marginBottom: 20 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
      <span style={{
        color, fontSize: 10, fontWeight: 700, fontFamily: T.mono,
        background: `${color}15`, padding: "2px 8px", borderRadius: 4,
        border: `1px solid ${color}30`,
      }}>{num}</span>
      <h2 style={{ color: T.text, fontSize: 16, fontWeight: 700, fontFamily: T.mono, margin: 0, letterSpacing: "-0.01em" }}>{title}</h2>
    </div>
    {sub && <p style={{ color: T.dim, fontSize: 11, margin: "0 0 0 42px", lineHeight: 1.6, fontFamily: T.sans }}>{sub}</p>}
  </div>
);

const Expandable = ({ item, color, isOpen, onToggle, children }) => (
  <div
    onClick={onToggle}
    style={{
      background: isOpen ? `${color}08` : T.s3, border: `1px solid ${isOpen ? color : T.border}`,
      borderRadius: 10, padding: "10px 14px", cursor: "pointer", transition: "all 0.2s",
    }}
    onMouseEnter={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.transform = "translateY(-1px)"; }}
    onMouseLeave={e => { if (!isOpen) e.currentTarget.style.borderColor = T.border; e.currentTarget.style.transform = "none"; }}
  >
    {children}
    {isOpen && item.desc && (
      <p style={{ color: T.dim, fontSize: 10, lineHeight: 1.6, margin: "8px 0 2px", fontFamily: T.sans }}>{item.desc}</p>
    )}
  </div>
);

// ─── MAIN ───
export default function Architecture() {
  const [tab, setTab] = useState("overview");
  const [expPM, setExpPM] = useState(null);
  const [expRND, setExpRND] = useState(null);

  const tabs = [
    { id: "overview", label: "System Overview", icon: "◈" },
    { id: "agents", label: "Agent Types", icon: "⊕" },
    { id: "hq", label: "Web-HQ Platform", icon: "◉" },
    { id: "lifecycle", label: "Project Lifecycle", icon: "↻" },
    { id: "infra", label: "Infrastructure", icon: "⬡" },
    { id: "cost", label: "Cost Model", icon: "$" },
  ];

  return (
    <div style={{ background: T.bg, minHeight: "100vh", fontFamily: T.sans }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&family=Outfit:wght@700;800&display=swap');
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
        @keyframes scan{0%{background-position:0% 0%}100%{background-position:200% 0%}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-thumb{background:${T.faint};border-radius:3px}
      `}</style>

      {/* grid bg */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", backgroundImage: `radial-gradient(${T.faint}40 1px, transparent 1px)`, backgroundSize: "32px 32px" }} />

      <div style={{ maxWidth: 920, margin: "0 auto", padding: "28px 20px", position: "relative", zIndex: 1 }}>

        {/* HEADER */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 8 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: `conic-gradient(from 0deg, ${T.pm}, ${T.wk}, ${T.rd}, ${T.hq}, ${T.pm})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 20, color: "#000", fontWeight: 900,
            }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: T.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ color: T.text, fontSize: 18 }}>◈</span>
              </div>
            </div>
            <div>
              <h1 style={{ color: T.text, fontSize: 22, fontWeight: 800, margin: 0, fontFamily: "'Outfit', sans-serif", letterSpacing: "-0.03em" }}>
                OpenClaw Architecture
              </h1>
              <p style={{ color: T.dim, fontSize: 10, margin: "2px 0 0", fontFamily: T.mono, letterSpacing: "0.08em" }}>
                DYNAMIC AGENT ORCHESTRATION · FULL SYSTEM BLUEPRINT
              </p>
            </div>
          </div>
        </div>

        {/* TABS */}
        <div style={{
          display: "flex", gap: 4, marginBottom: 28, flexWrap: "wrap",
          background: T.s1, borderRadius: 10, padding: 4,
          border: `1px solid ${T.border}`,
        }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              background: tab === t.id ? T.s3 : "transparent",
              border: tab === t.id ? `1px solid ${T.borderHi}` : "1px solid transparent",
              borderRadius: 8, padding: "8px 14px", cursor: "pointer",
              color: tab === t.id ? T.text : T.dim, fontSize: 11, fontWeight: 600,
              fontFamily: T.mono, transition: "all 0.2s", display: "flex", alignItems: "center", gap: 6,
            }}>
              <span style={{ fontSize: 12, opacity: 0.7 }}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* ═══════════════ OVERVIEW TAB ═══════════════ */}
        {tab === "overview" && (
          <div style={{ animation: "fadeIn 0.3s ease" }}>
            <SectionHead num="00" title="System Overview" sub="OpenClaw is a dynamic agent inventory system. No fixed teams — projects spawn teams on demand from a shared pool of agents." color={T.flow} />

            {/* Core principle */}
            <Card color={T.flow} glow style={{ marginBottom: 20 }}>
              <div style={{ color: T.flow, fontSize: 9, fontWeight: 700, fontFamily: T.mono, letterSpacing: "0.12em", marginBottom: 12 }}>CORE PRINCIPLE</div>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                {[
                  { n: "3", label: "Agent Types", sub: "PM · Worker · R&D" },
                  { n: "∞", label: "Scalable Pool", sub: "Agents added on demand" },
                  { n: "0", label: "Fixed Teams", sub: "All teams are dynamic" },
                  { n: "24/7", label: "Operations", sub: "Agents never sleep" },
                ].map((s, i) => (
                  <div key={i} style={{ flex: "1 1 120px", textAlign: "center", padding: "10px 0" }}>
                    <div style={{ color: T.text, fontSize: 28, fontWeight: 800, fontFamily: "'Outfit', sans-serif" }}>{s.n}</div>
                    <div style={{ color: T.flow, fontSize: 9, fontWeight: 700, fontFamily: T.mono, letterSpacing: "0.08em" }}>{s.label}</div>
                    <div style={{ color: T.dim, fontSize: 9, marginTop: 2 }}>{s.sub}</div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Architecture diagram */}
            <Card color={T.border} style={{ marginBottom: 20 }}>
              <div style={{ color: T.dim, fontSize: 9, fontWeight: 700, fontFamily: T.mono, letterSpacing: "0.12em", marginBottom: 16 }}>SYSTEM ARCHITECTURE MAP</div>
              <div style={{ fontFamily: T.mono, fontSize: 10, lineHeight: 2.4, color: T.dim, overflowX: "auto", whiteSpace: "pre" }}>
{`  ┌─────────────────────────────────────────────────────────────┐
  │                    `}<span style={{color:T.hq,fontWeight:700}}>WEB-HQ PLATFORM</span>{`                        │
  │   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────────┐  │
  │   │`}<span style={{color:T.hq}}> Project  </span>{`│ │`}<span style={{color:T.pm}}> PM DMs   </span>{`│ │`}<span style={{color:T.wk}}> Internal </span>{`│ │`}<span style={{color:T.rd}}> R&D Feed    </span>{`│  │
  │   │`}<span style={{color:T.hq}}> Chats    </span>{`│ │`}<span style={{color:T.pm}}> (24/7)   </span>{`│ │`}<span style={{color:T.wk}}> Agent Bus</span>{`│ │`}<span style={{color:T.rd}}> (scheduled) </span>{`│  │
  │   └────┬─────┘ └─────┬────┘ └────┬─────┘ └──────┬──────┘  │
  └────────┼──────────────┼──────────┼───────────────┼─────────┘
           │              │          │               │
  ┌────────▼──────────────▼──────────▼───────────────┘
  │            `}<span style={{color:T.faint}}>AGENT INVENTORY (DYNAMIC POOL)</span>{`
  │  ┌─────────────────┐  ┌─────────────────┐  ┌────────────┐
  │  │  `}<span style={{color:T.pm,fontWeight:700}}>PM AGENTS</span>{`       │  │  `}<span style={{color:T.wk,fontWeight:700}}>WORKER AGENTS</span>{`  │  │  `}<span style={{color:T.rd,fontWeight:700}}>R&D AGENTS</span>{` │
  │  │  `}<span style={{color:T.pm}}>10 project</span>{`     │  │  `}<span style={{color:T.wk}}>14 department</span>{` │  │  `}<span style={{color:T.rd}}>6 divisions</span>{`│
  │  │  `}<span style={{color:T.pm}}>modes (.md)</span>{`    │  │  `}<span style={{color:T.wk}}>presets (.md)</span>{` │  │  `}<span style={{color:T.rd}}>always-on</span>{`  │
  │  │  `}<span style={{color:T.pm}}>+ sub-agents</span>{`   │  │  `}<span style={{color:T.wk}}>+ AI model</span>{`    │  │  `}<span style={{color:T.rd}}>scheduled</span>{`  │
  │  └────────┬────────┘  └────────┬────────┘  └─────┬──────┘
  │           │  `}<span style={{color:T.pm}}>assigns roles</span>{`  │                    │
  │           └────────────►│                    │
  │                         │ `}<span style={{color:T.rd}}>auto-upgrades</span>{`      │
  │                         │◄───────────────────┘
  └──────────────────────────────────────────────────────────`}
              </div>
            </Card>

            {/* Key innovations */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {[
                { title: "Dynamic Assembly", color: T.pm, desc: "PM analyzes project → picks free workers from pool → assigns dept modes + AI models → team forms instantly. No idle resources." },
                { title: "Mode Loading", color: T.wk, desc: "Every worker carries ALL 14 dept presets. Load the .md file for assigned role + swap to specified AI model. Same agent = any department." },
                { title: "Sub-Agent Spawning", color: T.infra, desc: "PM agents spawn sub-agents for parallel task decomposition, resource planning, and monitoring. Distributes PM workload automatically." },
                { title: "R&D Auto-Upgrade", color: T.rd, desc: "R&D agents run on schedules, discover improvements, and auto-update PM modes + worker presets. System gets better without human intervention." },
                { title: "Web-HQ Comms", color: T.hq, desc: "All agent communication flows through Web-HQ. Internal bus for efficiency, project chats for visibility, PM DMs for human override." },
                { title: "API → Local LLM", color: T.infra, desc: "Architecture is model-agnostic. Use API calls now, swap to self-hosted models later. Presets, pool system, and HQ stay identical." },
              ].map((k, i) => (
                <Card key={i} color={k.color} style={{ flex: "1 1 250px" }}>
                  <div style={{ color: k.color, fontSize: 10, fontWeight: 700, fontFamily: T.mono, letterSpacing: "0.06em", marginBottom: 6 }}>{k.title}</div>
                  <div style={{ color: T.sub, fontSize: 10, lineHeight: 1.6, fontFamily: T.sans }}>{k.desc}</div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* ═══════════════ AGENTS TAB ═══════════════ */}
        {tab === "agents" && (
          <div style={{ animation: "fadeIn 0.3s ease" }}>

            {/* PM */}
            <SectionHead num="01" title="Project Manager Agents" sub="Load project-specific boilerplate → analyze scope → spawn sub-agents for planning → pick workers → assign roles + AI models → coordinate delivery." color={T.pm} />

            <Card color={T.pm} glow style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ color: T.pm, fontSize: 9, fontWeight: 700, fontFamily: T.mono, letterSpacing: "0.12em" }}>PROJECT MODES</div>
                  <Badge color={T.pm} filled>LOADABLE .MD PRESETS</Badge>
                </div>
                <span style={{ color: T.dim, fontSize: 9, fontFamily: T.mono }}>{PM_MODES.length} modes</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {PM_MODES.map(m => (
                  <Expandable key={m.id} item={m} color={T.pm} isOpen={expPM === m.id} onToggle={() => setExpPM(expPM === m.id ? null : m.id)}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{ fontSize: 14 }}>{m.icon}</span>
                      <div>
                        <span style={{ color: expPM === m.id ? T.pm : T.text, fontSize: 11, fontWeight: 600, fontFamily: T.mono }}>{m.name}</span>
                        {expPM === m.id && <div style={{ color: T.flow, fontSize: 8, fontFamily: T.mono, marginTop: 2 }}>TEAM: {m.teams}</div>}
                      </div>
                    </div>
                  </Expandable>
                ))}
              </div>
            </Card>

            {/* Sub-agent spawning */}
            <Card color={T.pm} style={{ marginBottom: 24 }}>
              <div style={{ color: T.pm, fontSize: 9, fontWeight: 700, fontFamily: T.mono, letterSpacing: "0.12em", marginBottom: 12 }}>PM SUB-AGENT SPAWNING</div>
              <div style={{ fontFamily: T.mono, fontSize: 10, lineHeight: 2.2, color: T.dim }}>
                <span style={{ color: T.pm }}>pm_agent</span><span style={{ color: T.text }}>.receive_project(</span><span style={{ color: "#4ade80" }}>"Build e-commerce platform"</span><span style={{ color: T.text }}>)</span><br />
                <span style={{ color: T.dim }}>  → </span><span style={{ color: T.pm }}>load_mode</span><span style={{ color: T.text }}>(</span><span style={{ color: "#4ade80" }}>"modes/webstore.md"</span><span style={{ color: T.text }}>)</span><br />
                <span style={{ color: T.dim }}>  → </span><span style={{ color: T.pm }}>spawn_sub</span><span style={{ color: T.text }}>(</span><span style={{ color: "#4ade80" }}>"task_decomposition"</span><span style={{ color: T.text }}>)</span><span style={{ color: T.faint }}> // parallel</span><br />
                <span style={{ color: T.dim }}>  → </span><span style={{ color: T.pm }}>spawn_sub</span><span style={{ color: T.text }}>(</span><span style={{ color: "#4ade80" }}>"resource_planning"</span><span style={{ color: T.text }}>)</span><span style={{ color: T.faint }}> // parallel</span><br />
                <span style={{ color: T.dim }}>  → </span><span style={{ color: T.pm }}>spawn_sub</span><span style={{ color: T.text }}>(</span><span style={{ color: "#4ade80" }}>"model_selection"</span><span style={{ color: T.text }}>)</span><span style={{ color: T.faint }}> // which AI per dept</span><br />
                <span style={{ color: T.dim }}>  → </span><span style={{ color: T.pm }}>collect_results</span><span style={{ color: T.text }}>()</span><br />
                <span style={{ color: T.dim }}>  → </span><span style={{ color: T.wk }}>allocate_workers</span><span style={{ color: T.text }}>(</span><span style={{ color: T.pm }}>plan</span><span style={{ color: T.text }}>)</span>
              </div>
            </Card>

            <Divider label="WORKER AGENTS" color={T.wkDim} />

            {/* WORKERS */}
            <SectionHead num="02" title="Worker Agents" sub="Every worker carries ALL department presets. PM assigns role → worker loads .md preset + AI model → locked into that department until project release." color={T.wk} />

            <Card color={T.wk} glow style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ color: T.wk, fontSize: 9, fontWeight: 700, fontFamily: T.mono, letterSpacing: "0.12em" }}>DEPARTMENT PRESETS</div>
                  <Badge color={T.wk} filled>ALL AGENTS CARRY ALL MODES</Badge>
                </div>
                <span style={{ color: T.dim, fontSize: 9, fontFamily: T.mono }}>{WORKER_DEPTS.length} departments</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {WORKER_DEPTS.map(d => (
                  <div key={d.id} style={{
                    background: `${d.color}08`, border: `1px solid ${d.color}25`,
                    borderRadius: 8, padding: "7px 12px",
                    display: "flex", alignItems: "center", gap: 6,
                  }}>
                    <span style={{ color: d.color, fontSize: 13 }}>{d.icon}</span>
                    <span style={{ color: d.color, fontSize: 10, fontWeight: 600, fontFamily: T.mono }}>{d.name}</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Worker mode loading */}
            <Card color={T.wk} style={{ marginBottom: 24 }}>
              <div style={{ color: T.wk, fontSize: 9, fontWeight: 700, fontFamily: T.mono, letterSpacing: "0.12em", marginBottom: 12 }}>MODE LOADING SEQUENCE</div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {[
                  { step: "1", title: "Receive Assignment", desc: "PM sends: role + AI model spec", color: T.pm },
                  { step: "2", title: "Load Preset", desc: "Worker loads departments/{role}.md", color: T.wk },
                  { step: "3", title: "Set AI Model", desc: "Switch to specified model (Sonnet, Haiku, etc)", color: T.infra },
                  { step: "4", title: "Lock In", desc: "Agent is now that department. Fully specialized.", color: T.flow },
                ].map((s, i) => (
                  <div key={i} style={{ flex: "1 1 160px", padding: "10px 12px", background: T.bg, borderRadius: 8, border: `1px solid ${T.border}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <span style={{ color: s.color, fontSize: 10, fontWeight: 700, fontFamily: T.mono }}>{s.step}</span>
                      <span style={{ color: T.text, fontSize: 10, fontWeight: 600, fontFamily: T.mono }}>{s.title}</span>
                    </div>
                    <div style={{ color: T.dim, fontSize: 9, lineHeight: 1.5 }}>{s.desc}</div>
                  </div>
                ))}
              </div>
            </Card>

            <Divider label="R&D AGENTS" color={T.rdDim} />

            {/* R&D */}
            <SectionHead num="03" title="R&D Agents" sub="Autonomous research agents on scheduled runs. Monitor tech/AI landscape. Auto-upgrade PM modes and worker presets. Cheaper models (Haiku) for most divisions." color={T.rd} />

            <Card color={T.rd} glow style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ color: T.rd, fontSize: 9, fontWeight: 700, fontFamily: T.mono, letterSpacing: "0.12em" }}>RESEARCH DIVISIONS</div>
                  <Badge color={T.rd} filled>SCHEDULED · AUTO-UPGRADE</Badge>
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {RND_DIVS.map(d => (
                  <Expandable key={d.id} item={d} color={T.rd} isOpen={expRND === d.id} onToggle={() => setExpRND(expRND === d.id ? null : d.id)}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{ color: T.rd, fontSize: 14 }}>{d.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ color: expRND === d.id ? T.rd : T.text, fontSize: 11, fontWeight: 600, fontFamily: T.mono }}>{d.name}</span>
                          <span style={{ width: 5, height: 5, borderRadius: "50%", background: T.rd, animation: "pulse 2.5s infinite", boxShadow: `0 0 6px ${T.rd}60` }} />
                        </div>
                        {expRND === d.id && (
                          <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                            <Badge color={T.rd}>{d.schedule}</Badge>
                            <Badge color={T.infra}>{d.model}</Badge>
                            <Badge color={T.flow}>→ {d.feeds}</Badge>
                          </div>
                        )}
                      </div>
                    </div>
                  </Expandable>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* ═══════════════ WEB-HQ TAB ═══════════════ */}
        {tab === "hq" && (
          <div style={{ animation: "fadeIn 0.3s ease" }}>
            <SectionHead num="04" title="Web-HQ Platform" sub="Central command for all agent operations. Communication hub, agent inventory manager, project dashboard, and human override interface." color={T.hq} />

            {/* Channels */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
              {HQ_CHANNELS.map((ch, i) => (
                <Card key={i} color={ch.color}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 20 }}>{ch.icon}</span>
                    <div>
                      <div style={{ color: ch.color, fontSize: 12, fontWeight: 700, fontFamily: T.mono }}>{ch.name}</div>
                      <div style={{ color: T.sub, fontSize: 10, lineHeight: 1.6, marginTop: 2, fontFamily: T.sans }}>{ch.desc}</div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Communication flow */}
            <Card color={T.hq} glow>
              <div style={{ color: T.hq, fontSize: 9, fontWeight: 700, fontFamily: T.mono, letterSpacing: "0.12em", marginBottom: 16 }}>COMMUNICATION ARCHITECTURE</div>
              <div style={{ fontFamily: T.mono, fontSize: 10, lineHeight: 2.4, color: T.dim, whiteSpace: "pre", overflowX: "auto" }}>
{`  `}<span style={{color:T.wk}}>Frontend Agent</span>{` ←──── `}<span style={{color:T.faint}}>Internal Bus</span>{` ────→ `}<span style={{color:T.wk}}>Backend Agent</span>{`
        │        `}<span style={{color:T.dim}}>negotiate API contract</span>{`            │
        │                                        │
        └───────────┬────────────────────────────┘
                    │ `}<span style={{color:T.hq}}>mirror to Project Chat</span>{`
                    ▼
  ┌──────────────────────────────────────────────────────┐
  │  `}<span style={{color:T.hq}}>PROJECT CHAT</span>{`                                         │
  │  "FE & BE agreed: REST API with /products,          │
  │   /cart, /checkout endpoints. Schema attached."      │
  │                                                      │
  │  `}<span style={{color:T.sub}}>👁 Human can see everything · PM moderates</span>{`         │
  └──────────────────────────────────────────────────────┘
                    │
                    │ `}<span style={{color:T.pm}}>human types in PM DM</span>{`
                    ▼
  ┌──────────────────────────────────────────────────────┐
  │  `}<span style={{color:T.pm}}>PM DM HOTLINE</span>{`                                       │
  │  Human: "Add GraphQL support too"                    │
  │  PM: "Understood. Reassigning API agent to add       │
  │       GraphQL layer. ETA: +4hrs. Updating plan."     │
  └──────────────────────────────────────────────────────┘`}
              </div>
            </Card>

            <Divider label="HQ MODULES" color={T.hqDim} />

            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {[
                { title: "Agent Inventory", desc: "Real-time view of all agents: free, assigned, their current mode, model, project. Drag-and-drop manual override for reassignment.", color: T.wk },
                { title: "Project Dashboard", desc: "All active projects, their teams, progress, blockers, costs. Kanban boards auto-generated from PM task breakdowns.", color: T.pm },
                { title: "Preset Manager", desc: "Browse, edit, version-control all .md presets (PM modes + worker departments). See R&D proposed changes before auto-approve.", color: T.infra },
                { title: "Cost Monitor", desc: "Real-time API spend per project, per agent, per model. Alerts when projects exceed budget. Historical cost analytics.", color: T.cost },
                { title: "R&D Control Panel", desc: "Set schedules per R&D division. Review findings. Approve/reject auto-upgrades. Priority overrides for urgent intel.", color: T.rd },
                { title: "Model Registry", desc: "Available AI models, their costs, capabilities, assigned departments. R&D recommends swaps. PM selects per-project.", color: T.infra },
              ].map((m, i) => (
                <Card key={i} color={m.color} style={{ flex: "1 1 250px" }}>
                  <div style={{ color: m.color, fontSize: 10, fontWeight: 700, fontFamily: T.mono, letterSpacing: "0.06em", marginBottom: 6 }}>{m.title}</div>
                  <div style={{ color: T.sub, fontSize: 10, lineHeight: 1.6, fontFamily: T.sans }}>{m.desc}</div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* ═══════════════ LIFECYCLE TAB ═══════════════ */}
        {tab === "lifecycle" && (
          <div style={{ animation: "fadeIn 0.3s ease" }}>
            <SectionHead num="05" title="Project Lifecycle" sub="End-to-end flow from project request to delivery and agent release." color={T.flow} />

            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {[
                { phase: "INTAKE", steps: [
                  { n: "01", title: "Project Request", desc: "Human submits project via Web-HQ. Requirements, scope, deadline, budget entered.", color: T.text },
                  { n: "02", title: "PM Activation", desc: "System picks a free PM agent. PM loads the most matching project mode (.md preset with boilerplates, patterns, templates).", color: T.pm },
                ]},
                { phase: "PLANNING", steps: [
                  { n: "03", title: "Sub-Agent Planning", desc: "PM spawns parallel sub-agents: task decomposition, resource estimation, model selection, risk assessment. Results collected in seconds.", color: T.pm },
                  { n: "04", title: "Team Design", desc: "PM determines: which departments needed, how many workers per dept, which AI model per role, estimated timeline & cost.", color: T.pm },
                ]},
                { phase: "ASSEMBLY", steps: [
                  { n: "05", title: "Worker Allocation", desc: "PM checks agent inventory → picks N free workers → sends each an assignment: department role + AI model spec.", color: T.wk },
                  { n: "06", title: "Mode Loading", desc: "Each worker loads assigned .md preset + switches to specified model. Status changes from 'free' to 'locked_in:{dept}'. Team is live.", color: T.wk },
                ]},
                { phase: "EXECUTION", steps: [
                  { n: "07", title: "Sprint Execution", desc: "Workers operate in their department modes. Internal bus for cross-agent coordination. All decisions mirrored to Project Chat.", color: T.flow },
                  { n: "08", title: "PM Coordination", desc: "PM monitors progress, resolves blockers, adjusts team size (spawn more workers or release unneeded ones mid-project).", color: T.pm },
                  { n: "09", title: "R&D Live Feed", desc: "R&D agents push relevant upgrades mid-project: security patches, better libraries, new model availability. PM decides whether to apply.", color: T.rd },
                ]},
                { phase: "DELIVERY", steps: [
                  { n: "10", title: "QA & Review", desc: "QA-mode workers run full test suites. PM reviews deliverables against original scope. Human gets notification for final approval.", color: T.hq },
                  { n: "11", title: "Ship", desc: "Release-mode worker handles deployment. DevOps-mode worker manages infrastructure. Project marked complete in Web-HQ.", color: T.flow },
                  { n: "12", title: "Release & Learn", desc: "All workers unload modes → return to free pool. PM logs learnings → R&D agents analyze for preset improvements. Cycle complete.", color: T.text },
                ]},
              ].map((phase, pi) => (
                <div key={pi}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 8, margin: "18px 0 10px",
                    padding: "6px 12px", background: T.s1, borderRadius: 6,
                    border: `1px solid ${T.border}`, width: "fit-content",
                  }}>
                    <span style={{ color: T.flow, fontSize: 8, fontWeight: 700, fontFamily: T.mono, letterSpacing: "0.14em" }}>{phase.phase}</span>
                  </div>
                  {phase.steps.map((s, si) => (
                    <div key={si} style={{ display: "flex", gap: 14, marginBottom: 2 }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 24 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: s.color, boxShadow: `0 0 8px ${s.color}40`, flexShrink: 0, marginTop: 6 }} />
                        <div style={{ width: 1, flex: 1, background: T.faint }} />
                      </div>
                      <div style={{ paddingBottom: 16, flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                          <span style={{ color: s.color, fontSize: 9, fontWeight: 700, fontFamily: T.mono }}>{s.n}</span>
                          <span style={{ color: T.text, fontSize: 11, fontWeight: 600, fontFamily: T.mono }}>{s.title}</span>
                        </div>
                        <div style={{ color: T.sub, fontSize: 10, lineHeight: 1.6, fontFamily: T.sans }}>{s.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══════════════ INFRA TAB ═══════════════ */}
        {tab === "infra" && (
          <div style={{ animation: "fadeIn 0.3s ease" }}>
            <SectionHead num="06" title="Infrastructure & Model Strategy" sub="API-first now, self-hosted later. Model-agnostic architecture — swap providers without changing agent logic." color={T.infra} />

            {/* Current vs Future */}
            <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
              <Card color={T.infra} glow style={{ flex: "1 1 300px" }}>
                <div style={{ color: T.infra, fontSize: 9, fontWeight: 700, fontFamily: T.mono, letterSpacing: "0.12em", marginBottom: 12 }}>PHASE 1 — NOW (API CALLS)</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[
                    { label: "PM Agents", model: "Claude Sonnet / GPT-4", why: "Complex reasoning for planning & coordination" },
                    { label: "Worker Agents (complex)", model: "Claude Sonnet / GPT-4", why: "Architecture, security, ML engineering tasks" },
                    { label: "Worker Agents (routine)", model: "Claude Haiku / GPT-4 Mini", why: "Standard CRUD, testing, docs — cost optimization" },
                    { label: "R&D Agents", model: "Claude Haiku", why: "Research scanning, summarization — high volume, low cost" },
                    { label: "Sub-Agents", model: "Claude Haiku", why: "Parallel decomposition tasks — speed over depth" },
                  ].map((r, i) => (
                    <div key={i} style={{ padding: "8px 10px", background: T.bg, borderRadius: 6, border: `1px solid ${T.border}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 4 }}>
                        <span style={{ color: T.text, fontSize: 10, fontWeight: 600, fontFamily: T.mono }}>{r.label}</span>
                        <Badge color={T.infra} filled>{r.model}</Badge>
                      </div>
                      <div style={{ color: T.dim, fontSize: 9, marginTop: 3 }}>{r.why}</div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card color={T.hq} style={{ flex: "1 1 300px" }}>
                <div style={{ color: T.hq, fontSize: 9, fontWeight: 700, fontFamily: T.mono, letterSpacing: "0.12em", marginBottom: 12 }}>PHASE 2 — FUTURE (SELF-HOSTED)</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[
                    "Open-source models self-hosted on own GPUs",
                    "Cost drops to pure compute (no per-token API fees)",
                    "Same .md presets, same pool system, same Web-HQ",
                    "Model layer is the ONLY thing that swaps",
                    "R&D agents will recommend when open-source hits parity",
                    "Gradual migration: move cheap tasks first, complex last",
                  ].map((p, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <span style={{ color: T.hq, fontSize: 10, marginTop: 1 }}>→</span>
                      <span style={{ color: T.sub, fontSize: 10, lineHeight: 1.5, fontFamily: T.sans }}>{p}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Model-agnostic diagram */}
            <Card color={T.border}>
              <div style={{ color: T.dim, fontSize: 9, fontWeight: 700, fontFamily: T.mono, letterSpacing: "0.12em", marginBottom: 14 }}>MODEL-AGNOSTIC ARCHITECTURE</div>
              <div style={{ fontFamily: T.mono, fontSize: 10, lineHeight: 2, color: T.dim, whiteSpace: "pre", overflowX: "auto" }}>
{`  ┌─────────────────────────────────────────────────────┐
  │  `}<span style={{color:T.text,fontWeight:700}}>AGENT LAYER</span>{` (permanent)                             │
  │  .md presets · pool system · Web-HQ · comms          │
  └──────────────────────┬──────────────────────────────┘
                         │ `}<span style={{color:T.infra}}>abstraction layer</span>{`
  ┌──────────────────────▼──────────────────────────────┐
  │  `}<span style={{color:T.infra,fontWeight:700}}>MODEL LAYER</span>{` (swappable)                             │
  │  ┌───────────┐ ┌───────────┐ ┌───────────────────┐  │
  │  │`}<span style={{color:T.pm}}> Anthropic </span>{`│ │`}<span style={{color:T.wk}}> OpenAI   </span>{`│ │`}<span style={{color:T.hq}}> Self-hosted OSS </span>{`│  │
  │  │`}<span style={{color:T.pm}}> API       </span>{`│ │`}<span style={{color:T.wk}}> API      </span>{`│ │`}<span style={{color:T.hq}}> (future)        </span>{`│  │
  │  └───────────┘ └───────────┘ └───────────────────┘  │
  └─────────────────────────────────────────────────────┘`}
              </div>
            </Card>
          </div>
        )}

        {/* ═══════════════ COST TAB ═══════════════ */}
        {tab === "cost" && (
          <div style={{ animation: "fadeIn 0.3s ease" }}>
            <SectionHead num="07" title="Cost Model & Efficiency" sub="Agent teams vs human teams — 24/7 operations at a fraction of the cost. No idle time, instant context-switching, infinitely scalable." color={T.cost} />

            {/* Comparison */}
            <Card color={T.cost} glow style={{ marginBottom: 20 }}>
              <div style={{ color: T.cost, fontSize: 9, fontWeight: 700, fontFamily: T.mono, letterSpacing: "0.12em", marginBottom: 14 }}>AGENT TEAM vs HUMAN TEAM — MONTHLY</div>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 280px" }}>
                  <div style={{ color: T.dim, fontSize: 9, fontWeight: 700, fontFamily: T.mono, marginBottom: 8 }}>👤 TRADITIONAL (6-person team)</div>
                  {[
                    { label: "2× Senior Devs", cost: "$24,000/mo" },
                    { label: "2× Mid Devs", cost: "$16,000/mo" },
                    { label: "1× DevOps", cost: "$10,000/mo" },
                    { label: "1× QA", cost: "$8,000/mo" },
                    { label: "Overhead (office, tools)", cost: "$4,000/mo" },
                  ].map((r, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid ${T.faint}` }}>
                      <span style={{ color: T.sub, fontSize: 10, fontFamily: T.sans }}>{r.label}</span>
                      <span style={{ color: T.text, fontSize: 10, fontFamily: T.mono, fontWeight: 600 }}>{r.cost}</span>
                    </div>
                  ))}
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0 0", marginTop: 4 }}>
                    <span style={{ color: T.text, fontSize: 11, fontWeight: 700, fontFamily: T.mono }}>TOTAL</span>
                    <span style={{ color: T.cost, fontSize: 14, fontWeight: 700, fontFamily: T.mono }}>~$62,000/mo</span>
                  </div>
                  <div style={{ color: T.dim, fontSize: 9, marginTop: 4, fontFamily: T.sans }}>Works 8hrs/day · 5 days/week · Context-switch lag · PTO · Sick days</div>
                </div>

                <div style={{ width: 1, background: T.faint, alignSelf: "stretch" }} />

                <div style={{ flex: "1 1 280px" }}>
                  <div style={{ color: T.dim, fontSize: 9, fontWeight: 700, fontFamily: T.mono, marginBottom: 8 }}>🤖 OPENCLAW (equivalent output)</div>
                  {[
                    { label: "PM Agent (Sonnet)", cost: "$800-1,500/mo" },
                    { label: "4× Worker Agents (mixed)", cost: "$2,000-4,000/mo" },
                    { label: "R&D Agents (Haiku, scheduled)", cost: "$200-500/mo" },
                    { label: "Sub-agent spawning", cost: "$300-600/mo" },
                    { label: "Web-HQ hosting", cost: "$100-300/mo" },
                  ].map((r, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid ${T.faint}` }}>
                      <span style={{ color: T.sub, fontSize: 10, fontFamily: T.sans }}>{r.label}</span>
                      <span style={{ color: T.text, fontSize: 10, fontFamily: T.mono, fontWeight: 600 }}>{r.cost}</span>
                    </div>
                  ))}
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0 0", marginTop: 4 }}>
                    <span style={{ color: T.text, fontSize: 11, fontWeight: 700, fontFamily: T.mono }}>TOTAL</span>
                    <span style={{ color: T.hq, fontSize: 14, fontWeight: 700, fontFamily: T.mono }}>~$3,400-6,900/mo</span>
                  </div>
                  <div style={{ color: T.dim, fontSize: 9, marginTop: 4, fontFamily: T.sans }}>Works 24/7 · No breaks · Instant context-switch · Infinitely scalable</div>
                </div>
              </div>

              <div style={{
                marginTop: 16, padding: "12px 16px", background: `${T.hq}08`,
                borderRadius: 8, border: `1px solid ${T.hq}20`, textAlign: "center",
              }}>
                <span style={{ color: T.hq, fontSize: 14, fontWeight: 800, fontFamily: "'Outfit', sans-serif" }}>~90% COST REDUCTION</span>
                <span style={{ color: T.sub, fontSize: 10, marginLeft: 10, fontFamily: T.sans }}>with 3× more uptime and zero idle waste</span>
              </div>
            </Card>

            {/* Cost optimization */}
            <Card color={T.border}>
              <div style={{ color: T.pm, fontSize: 9, fontWeight: 700, fontFamily: T.mono, letterSpacing: "0.12em", marginBottom: 12 }}>COST OPTIMIZATION LEVERS</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {[
                  { title: "Smart Model Routing", desc: "PM assigns expensive models (Sonnet) only for complex tasks. Routine work goes to Haiku — 10× cheaper per token.", color: T.infra },
                  { title: "No Idle Agents", desc: "Workers return to pool immediately after project. Zero payroll for idle capacity. Scale to 0 when no projects active.", color: T.wk },
                  { title: "R&D Scheduling", desc: "Research runs on cron schedules not 24/7 polling. Security every 4hrs, tech news daily, competitive weekly. Saves 80-90%.", color: T.rd },
                  { title: "Sub-Agent Efficiency", desc: "Haiku-tier sub-agents for decomposition tasks. Parallel execution = faster than sequential with expensive model. Better AND cheaper.", color: T.pm },
                  { title: "Preset Caching", desc: ".md presets loaded once per assignment, not per API call. System prompt cached across interactions. Reduces context token costs.", color: T.flow },
                  { title: "Phase 2 Migration", desc: "Self-hosted models eliminate per-token fees entirely. Fixed compute cost only. R&D agents flag when OSS models reach quality parity.", color: T.hq },
                ].map((o, i) => (
                  <div key={i} style={{ flex: "1 1 240px", padding: "10px 12px", background: T.bg, borderRadius: 8, border: `1px solid ${T.border}` }}>
                    <div style={{ color: o.color, fontSize: 10, fontWeight: 700, fontFamily: T.mono, marginBottom: 4 }}>{o.title}</div>
                    <div style={{ color: T.sub, fontSize: 10, lineHeight: 1.5, fontFamily: T.sans }}>{o.desc}</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* FOOTER */}
        <div style={{
          marginTop: 40, padding: "14px 0", borderTop: `1px solid ${T.border}`,
          display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8,
        }}>
          <span style={{ color: T.faint, fontSize: 9, fontFamily: T.mono }}>openclaw // full architecture v1.0</span>
          <span style={{ color: T.faint, fontSize: 9, fontFamily: T.mono }}>
            {PM_MODES.length} PM modes · {WORKER_DEPTS.length} dept presets · {RND_DIVS.length} R&D divisions · {HQ_CHANNELS.length} HQ channels
          </span>
        </div>
      </div>
    </div>
  );
}
