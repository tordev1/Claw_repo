import { useState, useEffect, useRef } from "react";

const C = {
  bg: "#06060b",
  surface: "#0c0c14",
  card: "#10101c",
  border: "#1a1a2e",
  borderLit: "#2a2a44",
  pm: "#f59e0b",
  worker: "#3b82f6",
  rnd: "#ef4444",
  mode: "#8b5cf6",
  flow: "#22d3ee",
  text: "#e2e2f0",
  dim: "#555570",
  faint: "#2a2a3a",
};

const pmModes = [
  { id: "webstore", name: "Web Store", icon: "🛒", desc: "E-commerce platform boilerplate. Cart, checkout, payment integration, inventory management, product catalog architecture." },
  { id: "saas", name: "SaaS Platform", icon: "☁️", desc: "Multi-tenant SaaS boilerplate. Auth, billing, dashboards, admin panels, subscription management, API layer." },
  { id: "mobileapp", name: "Mobile App", icon: "📱", desc: "Cross-platform mobile. Push notifications, offline sync, app store deployment, native performance patterns." },
  { id: "datapipeline", name: "Data Pipeline", icon: "🔄", desc: "ETL/streaming architecture. Data ingestion, transformation, warehousing, monitoring, alerting systems." },
  { id: "ai_ml", name: "AI/ML Product", icon: "🧠", desc: "ML-powered product. Model serving, training pipelines, feature stores, A/B testing, GPU orchestration." },
  { id: "api_platform", name: "API Platform", icon: "🔌", desc: "Developer platform. API gateway, docs, SDKs, rate limiting, versioning, developer portal, webhooks." },
  { id: "cms", name: "CMS / Content", icon: "📝", desc: "Content management system. WYSIWYG editing, media handling, SEO, multi-language, publishing workflows." },
  { id: "internal", name: "Internal Tools", icon: "🔧", desc: "Admin dashboards, CRUD generators, workflow automation, reporting tools, employee-facing systems." },
  { id: "gaming", name: "Gaming", icon: "🎮", desc: "Game backend/frontend. Real-time multiplayer, leaderboards, matchmaking, asset pipelines, physics." },
  { id: "iot", name: "IoT System", icon: "📡", desc: "Device management, telemetry ingestion, firmware OTA, edge computing, real-time monitoring dashboards." },
];

const workerDepts = [
  { id: "frontend", name: "Frontend UI", icon: "◧", color: "#60a5fa", desc: "React/Vue/Angular, component systems, state management, responsive design, accessibility, animations." },
  { id: "backend", name: "Backend", icon: "◨", color: "#34d399", desc: "API design, server logic, microservices, auth, business logic, caching, message queues." },
  { id: "devops", name: "DevOps", icon: "◩", color: "#f472b6", desc: "CI/CD, Docker/K8s, IaC (Terraform), monitoring, logging, cloud infra, auto-scaling." },
  { id: "database", name: "Database", icon: "◫", color: "#a78bfa", desc: "Schema design, query optimization, migrations, replication, sharding, backups, data integrity." },
  { id: "mobile", name: "Mobile Dev", icon: "◪", color: "#fb923c", desc: "iOS/Android/cross-platform, native perf, push notifications, offline-first, app store deploy." },
  { id: "security", name: "Security", icon: "◬", color: "#f87171", desc: "Pen testing, vulnerability scanning, encryption, compliance (SOC2/GDPR), incident response." },
  { id: "qa", name: "QA & Testing", icon: "◮", color: "#4ade80", desc: "Unit/integration/e2e, test automation, load testing, regression suites, bug triage." },
  { id: "uiux", name: "UI/UX Design", icon: "◐", color: "#c084fc", desc: "Wireframes, prototypes, user research, usability testing, design systems, interaction design." },
  { id: "data_eng", name: "Data Engineering", icon: "⬢", color: "#22d3ee", desc: "ETL pipelines, data warehousing, stream processing, Spark/Kafka, data quality monitoring." },
  { id: "ml_eng", name: "ML Engineering", icon: "⬠", color: "#e879f9", desc: "Model training/deployment, MLOps, feature engineering, model monitoring, GPU optimization." },
  { id: "api_int", name: "API & Integration", icon: "◭", color: "#38bdf8", desc: "REST/GraphQL/gRPC, third-party integrations, webhooks, API versioning, SDK development." },
  { id: "perf", name: "Performance", icon: "◕", color: "#fbbf24", desc: "Load testing, bottleneck analysis, caching, CDN, bundle optimization, Core Web Vitals." },
  { id: "content", name: "Content & Docs", icon: "◒", color: "#86efac", desc: "Technical writing, API docs, user guides, marketing copy, SEO, knowledge base." },
  { id: "release", name: "Release Eng", icon: "◖", color: "#fb7185", desc: "Version management, feature flags, rollbacks, changelogs, deployment coordination." },
];

const rndDivisions = [
  { id: "ai_news", name: "AI/ML Research", icon: "⟐", desc: "Monitors arxiv, HuggingFace, model releases. Evaluates new techniques, benchmarks. Suggests model upgrades for worker agents." },
  { id: "tech_news", name: "Tech & Framework News", icon: "⟑", desc: "HackerNews, TechCrunch, framework changelogs. Flags breaking changes, new releases, deprecations. Auto-updates presets." },
  { id: "security_intel", name: "Security Intelligence", icon: "⟒", desc: "CVE monitoring, zero-day tracking, supply chain alerts. Auto-generates patch recommendations, updates security presets." },
  { id: "oss_scout", name: "Open Source Scout", icon: "⟓", desc: "Trending repos, new libraries, license checks. Recommends better alternatives, updates dependency presets." },
  { id: "tooling", name: "Tooling & Infra", icon: "⟔", desc: "New dev tools, CI/CD improvements, cloud service updates. Benchmarks and auto-upgrades operational presets." },
  { id: "competitive", name: "Competitive Intel", icon: "⟕", desc: "Competitor products, pricing, features, hiring. Weekly intelligence briefs for PM mode updates." },
];

function useSimulation() {
  const [agents, setAgents] = useState(() => {
    const pool = [];
    for (let i = 0; i < 8; i++) pool.push({ id: `w${i}`, type: "worker", status: "free", mode: null, project: null });
    return pool;
  });
  const [activeProject, setActiveProject] = useState(null);
  const timerRef = useRef(null);

  const runSim = (projectMode) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setAgents((prev) => prev.map((a) => ({ ...a, status: "free", mode: null, project: null })));
    setActiveProject(projectMode);

    const deptMap = {
      webstore: ["frontend", "backend", "database", "devops", "uiux", "qa"],
      saas: ["frontend", "backend", "database", "devops", "security", "api_int"],
      mobileapp: ["mobile", "backend", "uiux", "qa", "devops"],
      datapipeline: ["data_eng", "backend", "devops", "perf"],
      ai_ml: ["ml_eng", "backend", "data_eng", "devops", "perf"],
      api_platform: ["backend", "api_int", "content", "security", "qa"],
      cms: ["frontend", "backend", "database", "uiux", "content"],
      internal: ["frontend", "backend", "database", "qa"],
      gaming: ["frontend", "backend", "perf", "devops", "qa"],
      iot: ["backend", "devops", "data_eng", "security", "perf"],
    };
    const needed = deptMap[projectMode.id] || ["frontend", "backend", "devops"];

    let step = 0;
    timerRef.current = setInterval(() => {
      step++;
      if (step <= needed.length) {
        setAgents((prev) => {
          const next = [...prev];
          const freeIdx = next.findIndex((a) => a.status === "free");
          if (freeIdx !== -1) {
            next[freeIdx] = { ...next[freeIdx], status: "assigned", mode: needed[step - 1], project: projectMode.id };
          }
          return next;
        });
      }
      if (step > needed.length + 2) clearInterval(timerRef.current);
    }, 600);
  };

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);
  return { agents, activeProject, runSim };
}

function AgentDot({ agent }) {
  const isAssigned = agent.status === "assigned";
  const dept = isAssigned ? workerDepts.find((d) => d.id === agent.mode) : null;
  const col = dept ? dept.color : C.dim;
  return (
    <div style={{
      width: 36, height: 36, borderRadius: "50%",
      border: `2px solid ${isAssigned ? col : C.faint}`,
      background: isAssigned ? `${col}20` : "transparent",
      display: "flex", alignItems: "center", justifyContent: "center",
      transition: "all 0.5s ease", position: "relative",
    }} title={isAssigned ? `${agent.id} → ${dept?.name}` : `${agent.id} (free)`}>
      {isAssigned && <span style={{ fontSize: 12, color: col }}>{dept?.icon}</span>}
      {isAssigned && (
        <div style={{
          position: "absolute", bottom: -14, fontSize: 7, color: col,
          fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, whiteSpace: "nowrap",
        }}>{dept?.name}</div>
      )}
    </div>
  );
}

function Section({ title, color, tag, children }) {
  return (
    <div style={{ marginBottom: 36 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{ width: 3, height: 20, background: color, borderRadius: 2 }} />
        <h2 style={{
          color, fontSize: 12, fontWeight: 700, margin: 0,
          fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.14em",
        }}>{title}</h2>
        {tag && (
          <span style={{
            background: `${color}15`, color, fontSize: 8, fontWeight: 700,
            padding: "2px 8px", borderRadius: 4, border: `1px solid ${color}30`,
            fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.1em",
          }}>{tag}</span>
        )}
      </div>
      {children}
    </div>
  );
}

export default function App() {
  const { agents, activeProject, runSim } = useSimulation();
  const [expandedPM, setExpandedPM] = useState(null);
  const [expandedWorker, setExpandedWorker] = useState(null);
  const [expandedRND, setExpandedRND] = useState(null);

  const assignedAgents = agents.filter((a) => a.status === "assigned");
  const freeAgents = agents.filter((a) => a.status === "free");

  return (
    <div style={{
      background: C.bg, minHeight: "100vh", padding: "28px 20px",
      fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600&display=swap');
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes scan { 0%{background-position:0% 0%} 100%{background-position:200% 0%} }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar{height:4px;width:4px} ::-webkit-scrollbar-thumb{background:${C.faint};border-radius:2px}
      `}</style>

      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none",
        backgroundImage: `linear-gradient(${C.faint}18 1px, transparent 1px), linear-gradient(90deg, ${C.faint}18 1px, transparent 1px)`,
        backgroundSize: "50px 50px",
      }} />

      <div style={{ maxWidth: 860, margin: "0 auto", position: "relative", zIndex: 1 }}>

        {/* HEADER */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: `linear-gradient(135deg, ${C.pm}, ${C.worker})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, color: "#000", fontWeight: 800,
            }}>◈</div>
            <h1 style={{
              color: C.text, fontSize: 20, fontWeight: 700, margin: 0,
              fontFamily: "'JetBrains Mono', monospace",
            }}>OpenClaw — Dynamic Agent Inventory</h1>
          </div>
          <p style={{ color: C.dim, fontSize: 11, margin: "0 0 0 48px", lineHeight: 1.6 }}>
            3 agent types · No fixed teams · Teams form dynamically per project from inventory
          </p>
        </div>

        {/* 3 TYPE CARDS */}
        <div style={{ display: "flex", gap: 10, marginBottom: 28, flexWrap: "wrap" }}>
          {[
            { label: "PM AGENTS", color: C.pm, count: pmModes.length + " project modes", sub: "Load project-specific boilerplate → analyze scope → pick workers → assign roles" },
            { label: "WORKER AGENTS", color: C.worker, count: workerDepts.length + " dept presets", sub: "Carry ALL presets. PM assigns role → agent loads that dept mode + AI model → locked in" },
            { label: "R&D AGENTS", color: C.rnd, count: rndDivisions.length + " divisions", sub: "24/7 autonomous. Monitor tech/AI → suggest upgrades → auto-update all presets" },
          ].map((t, i) => (
            <div key={i} style={{
              flex: "1 1 220px", background: C.surface, border: `1px solid ${t.color}30`,
              borderRadius: 12, padding: "16px 18px", position: "relative", overflow: "hidden",
            }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${t.color}, transparent)` }} />
              <div style={{ color: t.color, fontSize: 10, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.14em", marginBottom: 6 }}>{t.label}</div>
              <div style={{ color: C.text, fontSize: 18, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", marginBottom: 4 }}>{t.count}</div>
              <div style={{ color: C.dim, fontSize: 10, lineHeight: 1.5 }}>{t.sub}</div>
            </div>
          ))}
        </div>

        {/* FLOW */}
        <div style={{
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14,
          padding: 24, marginBottom: 36, overflow: "hidden",
        }}>
          <div style={{ color: C.dim, fontSize: 9, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.15em", marginBottom: 18 }}>
            PROJECT LIFECYCLE — DYNAMIC TEAM ASSEMBLY
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 0 }}>
            {[
              { step: "01", title: "Project Arrives", desc: "Requirements & scope enter the system", color: C.text, icon: "→" },
              { step: "02", title: "PM Loads Mode", desc: "Free PM agent activates, loads matching project preset (.md boilerplate)", color: C.pm, icon: "◈" },
              { step: "03", title: "Scope Analysis", desc: "PM breaks project into tasks, determines departments needed + AI models per role", color: C.pm, icon: "⊞" },
              { step: "04", title: "Pick Workers", desc: "PM checks inventory → picks N free workers → assigns each a dept role + model spec", color: C.worker, icon: "⊕" },
              { step: "05", title: "Workers Load Mode", desc: "Each worker loads its dept .md preset + designated AI model. Now locked into that role.", color: C.mode, icon: "↻" },
              { step: "06", title: "Build", desc: "Team executes. PM coordinates. R&D feeds live upgrades & patches mid-project.", color: C.flow, icon: "▶" },
              { step: "07", title: "Ship & Release", desc: "Project ships. All agents unload modes → return to free pool → ready for next project.", color: C.text, icon: "↩" },
            ].map((s, i) => (
              <div key={i} style={{ flex: "1 1 200px", padding: "10px 14px", borderLeft: i > 0 ? `1px solid ${C.faint}` : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <span style={{ color: s.color, fontSize: 14, opacity: 0.6 }}>{s.icon}</span>
                  <span style={{ color: s.color, fontSize: 9, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>STEP {s.step}</span>
                </div>
                <div style={{ color: C.text, fontSize: 11, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", marginBottom: 4 }}>{s.title}</div>
                <div style={{ color: C.dim, fontSize: 10, lineHeight: 1.5 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* SIMULATOR */}
        <div style={{
          background: `linear-gradient(135deg, ${C.surface}, ${C.pm}06)`,
          border: `1px solid ${C.pm}30`, borderRadius: 14, padding: 24, marginBottom: 36,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ color: C.pm, fontSize: 14 }}>▶</span>
            <span style={{ color: C.pm, fontSize: 10, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.14em" }}>LIVE SIMULATOR</span>
            <span style={{ color: C.dim, fontSize: 10, marginLeft: 4 }}>— click a project to watch PM assemble a team</span>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 18, marginTop: 12 }}>
            {pmModes.map((m) => (
              <button key={m.id} onClick={() => runSim(m)} style={{
                background: activeProject?.id === m.id ? `${C.pm}20` : C.card,
                border: `1px solid ${activeProject?.id === m.id ? C.pm : C.border}`,
                borderRadius: 8, padding: "6px 12px", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6, transition: "all 0.2s", color: C.text,
              }}>
                <span style={{ fontSize: 13 }}>{m.icon}</span>
                <span style={{
                  fontSize: 10, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace",
                  color: activeProject?.id === m.id ? C.pm : C.text,
                }}>{m.name}</span>
              </button>
            ))}
          </div>

          <div style={{ background: C.bg, borderRadius: 10, padding: 18, border: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <span style={{ color: C.dim, fontSize: 9, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.12em" }}>AGENT INVENTORY</span>
              <div style={{ display: "flex", gap: 12 }}>
                <span style={{ color: C.worker, fontSize: 9, fontFamily: "'JetBrains Mono', monospace" }}>● {assignedAgents.length} assigned</span>
                <span style={{ color: C.dim, fontSize: 9, fontFamily: "'JetBrains Mono', monospace" }}>○ {freeAgents.length} free</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center", paddingBottom: 10 }}>
              {agents.map((a) => <AgentDot key={a.id} agent={a} />)}
            </div>
            {activeProject && assignedAgents.length > 0 && (
              <div style={{
                marginTop: 16, padding: "10px 14px", background: `${C.pm}08`,
                borderRadius: 8, border: `1px solid ${C.pm}20`,
              }}>
                <span style={{ color: C.pm, fontSize: 9, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
                  PM ASSEMBLED TEAM FOR: {activeProject.name.toUpperCase()}
                </span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                  {assignedAgents.map((a) => {
                    const dept = workerDepts.find((d) => d.id === a.mode);
                    return dept ? (
                      <span key={a.id} style={{
                        background: `${dept.color}15`, border: `1px solid ${dept.color}40`,
                        color: dept.color, fontSize: 9, fontWeight: 600,
                        fontFamily: "'JetBrains Mono', monospace", padding: "3px 8px", borderRadius: 5,
                      }}>{dept.icon} {dept.name}</span>
                    ) : null;
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* PM MODES */}
        <Section title="PROJECT MANAGER AGENT — MODES" color={C.pm} tag={`${pmModes.length} PROJECT TYPES`}>
          <p style={{ color: C.dim, fontSize: 11, lineHeight: 1.6, margin: "0 0 14px 13px", maxWidth: 620 }}>
            Any free PM agent picks up a project → loads the matching mode preset. Each mode has boilerplates, architecture patterns, resource estimation, and task breakdown templates for that project type.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, paddingLeft: 13 }}>
            {pmModes.map((m) => (
              <div key={m.id} onClick={() => setExpandedPM(expandedPM === m.id ? null : m.id)} style={{
                background: expandedPM === m.id ? `${C.pm}10` : C.card,
                border: `1px solid ${expandedPM === m.id ? C.pm : C.border}`,
                borderRadius: 10, padding: "10px 14px", cursor: "pointer",
                transition: "all 0.2s ease", minWidth: 140,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.pm; e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={(e) => { if (expandedPM !== m.id) e.currentTarget.style.borderColor = C.border; e.currentTarget.style.transform = "none"; }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ fontSize: 15 }}>{m.icon}</span>
                  <span style={{ color: expandedPM === m.id ? C.pm : C.text, fontSize: 11, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>{m.name}</span>
                </div>
                {expandedPM === m.id && (
                  <p style={{ color: C.dim, fontSize: 10, lineHeight: 1.5, margin: "6px 0 0" }}>{m.desc}</p>
                )}
              </div>
            ))}
          </div>
        </Section>

        {/* WORKER DEPTS */}
        <Section title="WORKER AGENT — DEPARTMENT PRESETS (MODES)" color={C.worker} tag={`${workerDepts.length} DEPTS`}>
          <p style={{ color: C.dim, fontSize: 11, lineHeight: 1.6, margin: "0 0 14px 13px", maxWidth: 620 }}>
            Every worker agent has ALL these presets installed. PM assigns a role → worker loads that .md mode + specified AI model → agent IS that department until released. Same agent = Frontend today, DevOps tomorrow.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, paddingLeft: 13 }}>
            {workerDepts.map((d) => (
              <div key={d.id} onClick={() => setExpandedWorker(expandedWorker === d.id ? null : d.id)} style={{
                background: expandedWorker === d.id ? `${d.color}10` : C.card,
                border: `1px solid ${expandedWorker === d.id ? d.color : C.border}`,
                borderRadius: 10, padding: "10px 14px", cursor: "pointer",
                transition: "all 0.2s ease", minWidth: 140,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = d.color; e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={(e) => { if (expandedWorker !== d.id) e.currentTarget.style.borderColor = C.border; e.currentTarget.style.transform = "none"; }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ color: d.color, fontSize: 14 }}>{d.icon}</span>
                  <span style={{ color: expandedWorker === d.id ? d.color : C.text, fontSize: 11, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>{d.name}</span>
                </div>
                {expandedWorker === d.id && (
                  <p style={{ color: C.dim, fontSize: 10, lineHeight: 1.5, margin: "6px 0 0" }}>{d.desc}</p>
                )}
              </div>
            ))}
          </div>

          <div style={{
            margin: "18px 0 0 13px", padding: 16, background: C.bg, borderRadius: 10,
            border: `1px dashed ${C.mode}30`, maxWidth: 500,
          }}>
            <div style={{ color: C.mode, fontSize: 9, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.12em", marginBottom: 10 }}>
              MODE LOADING MECHANISM
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, lineHeight: 2.2 }}>
              <span style={{ color: C.dim }}>pm_agent</span><span style={{ color: C.text }}>.assign(</span><span style={{ color: C.pm }}>worker_03</span><span style={{ color: C.text }}>, </span><span style={{ color: "#4ade80" }}>"frontend"</span><span style={{ color: C.text }}>, </span><span style={{ color: "#4ade80" }}>"claude-sonnet"</span><span style={{ color: C.text }}>)</span><br />
              <span style={{ color: C.dim }}>  → worker_03</span><span style={{ color: C.text }}>.</span><span style={{ color: C.worker }}>load</span><span style={{ color: C.text }}>(</span><span style={{ color: "#4ade80" }}>"presets/frontend.md"</span><span style={{ color: C.text }}>)</span><br />
              <span style={{ color: C.dim }}>  → worker_03</span><span style={{ color: C.text }}>.</span><span style={{ color: C.worker }}>set_model</span><span style={{ color: C.text }}>(</span><span style={{ color: "#4ade80" }}>"claude-sonnet"</span><span style={{ color: C.text }}>)</span><br />
              <span style={{ color: C.dim }}>  → worker_03</span><span style={{ color: C.text }}>.</span><span style={{ color: C.flow }}>status</span><span style={{ color: C.text }}> = </span><span style={{ color: "#4ade80" }}>"locked_in:frontend"</span>
            </div>
          </div>
        </Section>

        {/* R&D */}
        <Section title="R&D AGENTS" color={C.rnd} tag="24/7 ALWAYS ON">
          <p style={{ color: C.dim, fontSize: 11, lineHeight: 1.6, margin: "0 0 14px 13px", maxWidth: 620 }}>
            Autonomous. Never assigned to projects. Run non-stop scanning the tech/AI landscape. Feed upgrades back into PM project modes and worker department presets. Can auto-upgrade or suggest upgrades system-wide.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, paddingLeft: 13 }}>
            {rndDivisions.map((d) => (
              <div key={d.id} onClick={() => setExpandedRND(expandedRND === d.id ? null : d.id)} style={{
                background: expandedRND === d.id ? `${C.rnd}10` : C.card,
                border: `1px solid ${expandedRND === d.id ? C.rnd : C.border}`,
                borderRadius: 10, padding: "10px 14px", cursor: "pointer",
                transition: "all 0.2s ease", minWidth: 160, position: "relative", overflow: "hidden",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.rnd; }}
              onMouseLeave={(e) => { if (expandedRND !== d.id) e.currentTarget.style.borderColor = C.border; }}
              >
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${C.rnd}60, transparent)`, backgroundSize: "200% 100%", animation: "scan 3s linear infinite" }} />
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ color: C.rnd, fontSize: 14 }}>{d.icon}</span>
                  <span style={{ color: expandedRND === d.id ? C.rnd : C.text, fontSize: 11, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>{d.name}</span>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.rnd, animation: "pulse 2s infinite", marginLeft: "auto", boxShadow: `0 0 8px ${C.rnd}60` }} />
                </div>
                {expandedRND === d.id && (
                  <p style={{ color: C.dim, fontSize: 10, lineHeight: 1.5, margin: "6px 0 0" }}>{d.desc}</p>
                )}
              </div>
            ))}
          </div>

          <div style={{
            margin: "18px 0 0 13px", padding: 14, background: C.bg, borderRadius: 10,
            border: `1px solid ${C.rnd}15`,
          }}>
            <div style={{ color: C.rnd, fontSize: 9, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.1em", marginBottom: 10 }}>
              R&D FEEDS BACK INTO EVERYTHING
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {[
                { to: "PM Project Modes", desc: "New architectures, patterns, tools for project boilerplates", arrow: "→" },
                { to: "Worker Dept Presets", desc: "Updated frameworks, best practices, security patches", arrow: "→" },
                { to: "AI Model Registry", desc: "Better models discovered → auto-swap recommendations", arrow: "→" },
                { to: "System Config", desc: "Infrastructure upgrades, cost optimizations, new services", arrow: "→" },
              ].map((f, i) => (
                <div key={i} style={{
                  flex: "1 1 180px", background: `${C.rnd}06`, border: `1px solid ${C.rnd}12`,
                  borderRadius: 8, padding: "8px 12px",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                    <span style={{ color: C.rnd, fontSize: 10 }}>{f.arrow}</span>
                    <span style={{ color: C.flow, fontSize: 10, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>{f.to}</span>
                  </div>
                  <div style={{ color: C.dim, fontSize: 9, lineHeight: 1.4 }}>{f.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* FOOTER */}
        <div style={{
          marginTop: 40, padding: "14px 0", borderTop: `1px solid ${C.border}`,
          display: "flex", justifyContent: "space-between",
        }}>
          <span style={{ color: C.faint, fontSize: 9, fontFamily: "'JetBrains Mono', monospace" }}>openclaw // dynamic agent inventory v0.2</span>
          <span style={{ color: C.faint, fontSize: 9, fontFamily: "'JetBrains Mono', monospace" }}>3 types · {pmModes.length + workerDepts.length + rndDivisions.length} total modes</span>
        </div>
      </div>
    </div>
  );
}
