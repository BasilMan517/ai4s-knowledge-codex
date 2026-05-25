import {
  BookOpen,
  Braces,
  BrainCircuit,
  Database,
  Download,
  FileText,
  GitBranch,
  Layers,
  Loader2,
  MessageSquareText,
  Network,
  Play,
  Search,
  Send,
  Table2
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Artifact, ChatMessage, EvidenceChunk, GraphEdge, GraphNode, Paper, Workspace, WorkspaceSummaryInfo } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE || (import.meta.env.DEV ? "http://localhost:8787" : "");
const DEFAULT_TOPIC = "solid-state electrolyte AI agents for materials discovery";

type WorkMode = "idle" | "building" | "loadingWorkspace";

const FACT_GROUPS = [
  {
    key: "studies_material_system",
    title: "Material systems",
    empty: "No material facts yet"
  },
  {
    key: "uses_method",
    title: "Methods",
    empty: "No method facts yet"
  },
  {
    key: "targets_property",
    title: "Properties",
    empty: "No property facts yet"
  }
];

function citation(paper: Paper) {
  const venue = paper.venue ? `${paper.venue}${paper.year ? `, ${paper.year}` : ""}` : paper.year || "";
  return `${paper.title}${venue ? ` (${venue})` : ""}${paper.doi ? ` DOI ${paper.doi}` : ""}`;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {})
    }
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || `${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

function TopBar({
  topic,
  setTopic,
  limit,
  setLimit,
  fromYear,
  setFromYear,
  health,
  loading,
  mode,
  onBuild
}: {
  topic: string;
  setTopic: (topic: string) => void;
  limit: number;
  setLimit: (limit: number) => void;
  fromYear: number;
  setFromYear: (year: number) => void;
  health?: { openaiConfigured: boolean; model: string };
  loading: boolean;
  mode: WorkMode;
  onBuild: () => void;
}) {
  return (
    <header className="topbar">
      <div className="brandRow">
        <div className="brand">
          <div className="brandMark">
            <BrainCircuit size={20} />
          </div>
          <div>
            <strong>AI4S Knowledge Codex</strong>
            <span>field intelligence workspace</span>
          </div>
        </div>

        <div className={`healthBadge ${health?.openaiConfigured ? "ready" : "fallback"}`}>
          {health?.openaiConfigured ? "Model online" : "Local mode"}
          <span>{health?.model || "checking"}</span>
        </div>
      </div>

      <div className="buildSurface">
        <label className="topicInput">
          <Search size={18} />
          <input
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            placeholder="输入材料/科学领域 topic"
            aria-label="Scientific topic"
          />
        </label>

        <div className="buildControls">
          <label>
            Papers
            <input
              type="number"
              min={5}
              max={100}
              value={limit}
              onChange={(event) => setLimit(Number(event.target.value))}
              aria-label="Paper limit"
            />
          </label>
          <label>
            Since
            <input
              type="number"
              min={1900}
              max={new Date().getFullYear()}
              value={fromYear}
              onChange={(event) => setFromYear(Number(event.target.value))}
              aria-label="From year"
            />
          </label>
        </div>

        <button className="iconButton primary" onClick={onBuild} disabled={loading || !topic.trim()}>
          {loading ? <Loader2 className="spin" size={18} /> : <Play size={18} />}
          <span>{mode === "building" ? "Building" : mode === "loadingWorkspace" ? "Loading" : "Generate"}</span>
        </button>
      </div>
    </header>
  );
}

function ProcessFlow({
  topic,
  workspace,
  artifacts,
  mode,
  buildTick
}: {
  topic: string;
  workspace?: Workspace;
  artifacts: Artifact[];
  mode: WorkMode;
  buildTick: number;
}) {
  const graph = workspace?.graph;
  const hasTopic = Boolean(topic.trim());
  const hasWorkspace = Boolean(workspace);
  const isBuilding = mode === "building";
  const activePhase = isBuilding ? Math.min(Math.floor(buildTick / 3), 3) : hasWorkspace ? 4 : hasTopic ? 0 : -1;
  const steps = [
    {
      icon: <Search size={18} />,
      title: "论文搜索",
      value: hasWorkspace ? `${workspace?.papers.length ?? 0} papers` : isBuilding ? "searching" : "waiting",
      detail: hasWorkspace ? "OpenAlex corpus" : "topic to corpus",
      state: hasWorkspace || activePhase > 0 ? "done" : activePhase === 0 ? "active" : "idle"
    },
    {
      icon: <Layers size={18} />,
      title: "知识库建立",
      value: hasWorkspace ? `${workspace?.facts.length ?? 0} facts` : isBuilding && activePhase === 1 ? "extracting" : "waiting",
      detail: hasWorkspace ? `${workspace?.entities.length ?? 0} entities, ${workspace?.chunks?.length ?? 0} chunks` : "entities, facts, evidence",
      state: hasWorkspace || activePhase > 1 ? "done" : activePhase === 1 ? "active" : "idle"
    },
    {
      icon: <Network size={18} />,
      title: "图谱生成",
      value: hasWorkspace ? `${graph?.edges.length ?? 0} edges` : isBuilding && activePhase === 2 ? "linking" : "waiting",
      detail: hasWorkspace ? `${graph?.nodes.length ?? 0} nodes` : "scientific relations",
      state: hasWorkspace || activePhase > 2 ? "done" : activePhase === 2 ? "active" : "idle"
    },
    {
      icon: <BrainCircuit size={18} />,
      title: "模型上下文",
      value: hasWorkspace ? "ready" : isBuilding && activePhase === 3 ? "assembling" : "waiting",
      detail: "grounded Codex layer",
      state: hasWorkspace ? "done" : activePhase === 3 ? "active" : "idle"
    }
  ];

  return (
    <section className="processDeck" aria-label="AI4S workflow">
      <div className="processHeader">
        <div>
          <span className="eyebrow">Topic to Private Model</span>
          <h2>{hasTopic ? topic : "输入一个科学领域"}</h2>
        </div>
        <div className={`modelState ${hasWorkspace ? "ready" : isBuilding ? "active" : ""}`}>
          <BrainCircuit size={18} />
          <span>{hasWorkspace ? "Model workspace ready" : isBuilding ? "Building model workspace" : "Awaiting topic"}</span>
        </div>
      </div>

      <div className="processBody">
        <div className="processFlow">
          {steps.map((step, index) => (
            <article className={`flowStep ${step.state}`} key={step.title}>
              <div className="stepIndex">
                <span>{index + 1}</span>
                {step.icon}
              </div>
              <div>
                <h3>{step.title}</h3>
                <strong>{step.value}</strong>
                <p>{step.detail}</p>
              </div>
            </article>
          ))}
        </div>

        <BuildTrace workspace={workspace} artifacts={artifacts} activePhase={activePhase} isBuilding={isBuilding} />
      </div>
    </section>
  );
}

function BuildTrace({
  workspace,
  artifacts,
  activePhase,
  isBuilding
}: {
  workspace?: Workspace;
  artifacts: Artifact[];
  activePhase: number;
  isBuilding: boolean;
}) {
  const graph = workspace?.graph;
  const rows = [
    {
      label: "Corpus search",
      value: workspace ? `${workspace.papers.length} papers indexed` : "OpenAlex query queue",
      detail: workspace?.papers[0]?.title || "ranking papers by relevance, year, citations"
    },
    {
      label: "Knowledge memory",
      value: workspace ? `${workspace.facts.length} facts, ${workspace.entities.length} entities` : "fact extraction queue",
      detail: workspace?.facts[0] ? `${workspace.facts[0].subject} -> ${workspace.facts[0].object}` : "extracting material systems, methods, properties"
    },
    {
      label: "Graph compiler",
      value: workspace ? `${graph?.nodes.length ?? 0} nodes, ${graph?.edges.length ?? 0} edges` : "relation linking queue",
      detail: workspace?.graph?.edges[0]?.label || "connecting evidence into a navigable field graph"
    },
    {
      label: "AI4S Codex layer",
      value: workspace ? `${artifacts.length} generated files` : "agent context queue",
      detail: workspace ? "chat, files, graph JSON, facts CSV stay available" : "packing retrieval context for grounded chat and deliverables"
    }
  ];

  return (
    <div className="buildTrace">
      <div className="traceHeader">
        <MessageSquareText size={16} />
        <span>{workspace ? "Generated model workspace" : isBuilding ? "Live build trace" : "Build trace"}</span>
      </div>
      {rows.map((row, index) => {
        const state = workspace || activePhase > index ? "done" : activePhase === index ? "active" : "idle";
        return (
          <article className={`traceRow ${state}`} key={row.label}>
            <span className="traceDot" />
            <div>
              <strong>{row.label}</strong>
              <p>{row.value}</p>
            </div>
            <small>{row.detail}</small>
          </article>
        );
      })}
    </div>
  );
}

function WorkspaceHistory({
  workspaces,
  activeId,
  loading,
  onLoad
}: {
  workspaces: WorkspaceSummaryInfo[];
  activeId?: string;
  loading: boolean;
  onLoad: (workspaceId: string) => void;
}) {
  if (!workspaces.length) return null;

  return (
    <details className="workspaceHistory">
      <summary>
        <span>Workspaces</span>
        <small>{workspaces.length} saved</small>
      </summary>
      <div className="workspaceChips">
        {workspaces.slice(0, 8).map((item) => (
          <button
            key={item.id}
            className={item.id === activeId ? "active" : ""}
            onClick={() => onLoad(item.id)}
            disabled={loading}
          >
            <span>{item.topic}</span>
            <small>
              {item.paperCount} papers · {item.factCount} facts
            </small>
          </button>
        ))}
      </div>
    </details>
  );
}

function ResearchMap({ workspace }: { workspace: Workspace }) {
  const max = Math.max(...workspace.clusters.map((cluster) => cluster.paperIds.length), 1);
  return (
    <div className="researchMap">
      {workspace.clusters.slice(0, 6).map((cluster) => (
        <section className="clusterBand" key={cluster.id}>
          <div className="clusterTop">
            <div>
              <h3>{cluster.label}</h3>
              <p>{cluster.terms.slice(0, 7).join(" · ")}</p>
            </div>
            <strong>{cluster.paperIds.length}</strong>
          </div>
          <div className="barTrack">
            <span style={{ width: `${(cluster.paperIds.length / max) * 100}%` }} />
          </div>
        </section>
      ))}
    </div>
  );
}

function FactMatrix({ workspace }: { workspace: Workspace }) {
  return (
    <div className="factMatrix">
      {FACT_GROUPS.map((group) => {
        const facts = workspace.facts.filter((fact) => fact.predicate === group.key).slice(0, 4);
        return (
          <section className="factColumn" key={group.key}>
            <div>
              <span>{facts.length}</span>
              <h3>{group.title}</h3>
            </div>
            {facts.length ? (
              facts.map((fact) => (
                <article key={fact.id}>
                  <strong>{fact.object}</strong>
                  <p>{fact.subject}</p>
                  <small>{Math.round(fact.confidence * 100)}% confidence</small>
                </article>
              ))
            ) : (
              <p className="mutedLine">{group.empty}</p>
            )}
          </section>
        );
      })}
    </div>
  );
}

function EntityCloud({ workspace }: { workspace: Workspace }) {
  return (
    <div className="entityCloud">
      {workspace.entities.slice(0, 18).map((entity) => (
        <span key={entity.id} className={`entityTag ${entity.type}`}>
          {entity.name}
          <small>{entity.paperIds.length}</small>
        </span>
      ))}
    </div>
  );
}

function GraphPreview({ nodes, edges }: { nodes: GraphNode[]; edges: GraphEdge[] }) {
  const visibleNodes = useMemo(() => nodes.slice(0, 14), [nodes]);
  const positioned = useMemo(
    () =>
      visibleNodes.map((node, index) => {
        const angle = (Math.PI * 2 * index) / Math.max(visibleNodes.length, 1) - Math.PI / 2;
        const radius = index === 0 ? 0 : 92;
        return {
          ...node,
          x: index === 0 ? 160 : 160 + Math.cos(angle) * radius,
          y: index === 0 ? 112 : 112 + Math.sin(angle) * radius
        };
      }),
    [visibleNodes]
  );
  const nodeById = useMemo(() => new Map(positioned.map((node) => [node.id, node])), [positioned]);
  const visibleEdges = edges.filter((edge) => nodeById.has(edge.source) && nodeById.has(edge.target)).slice(0, 18);

  if (!nodes.length) {
    return (
      <div className="graphPreview empty">
        <Network size={28} />
        <span>Graph appears after build</span>
      </div>
    );
  }

  return (
    <div className="graphPreview">
      <svg viewBox="0 0 320 224" role="img" aria-label="Knowledge graph preview">
        {visibleEdges.map((edge) => {
          const source = nodeById.get(edge.source);
          const target = nodeById.get(edge.target);
          if (!source || !target) return null;
          return <line key={edge.id} x1={source.x} y1={source.y} x2={target.x} y2={target.y} />;
        })}
        {positioned.map((node, index) => (
          <g key={node.id}>
            <circle className={index === 0 ? "coreNode" : ""} cx={node.x} cy={node.y} r={index === 0 ? 18 : 11} />
            <text x={node.x} y={node.y + 25}>
              {node.label.length > 18 ? `${node.label.slice(0, 18)}...` : node.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function KnowledgeStage({ workspace }: { workspace: Workspace }) {
  const graph = workspace.graph;
  const latestYear = Math.max(...workspace.papers.map((paper) => paper.year || 0));

  return (
    <section className="knowledgeStage">
      <div className="stageHeader">
        <div>
          <span className="eyebrow">Private AI4S Model Workspace</span>
          <h1>{workspace.topic}</h1>
        </div>
        <div className="metricPills">
          <span>{workspace.papers.length} papers</span>
          <span>{workspace.entities.length} entities</span>
          <span>{workspace.facts.length} facts</span>
          <span>{graph?.edges.length ?? 0} graph edges</span>
        </div>
      </div>

      <div className="knowledgeSnapshot">
        <article>
          <span>Corpus</span>
          <strong>{workspace.papers.length}</strong>
          <p>papers through {latestYear || "n.d."}</p>
        </article>
        <article>
          <span>Knowledge memory</span>
          <strong>{workspace.facts.length}</strong>
          <p>typed facts with evidence</p>
        </article>
        <article>
          <span>Model substrate</span>
          <strong>{graph?.nodes.length ?? 0}</strong>
          <p>nodes connected by {graph?.edges.length ?? 0} relations</p>
        </article>
      </div>

      <div className="stageGrid">
        <div>
          <div className="sectionTitle">
            <GitBranch size={17} />
            <h2>Research map</h2>
          </div>
          <ResearchMap workspace={workspace} />
        </div>
        <div>
          <div className="sectionTitle">
            <Network size={17} />
            <h2>Graph preview</h2>
          </div>
          <GraphPreview nodes={graph?.nodes || []} edges={graph?.edges || []} />
        </div>
      </div>

      <div className="kbShowcase">
        <div className="sectionTitle">
          <Database size={17} />
          <h2>Knowledge base</h2>
        </div>
        <FactMatrix workspace={workspace} />
        <EntityCloud workspace={workspace} />
      </div>
    </section>
  );
}

function ChatPanel({
  workspace,
  messages,
  evidence,
  question,
  setQuestion,
  loading,
  onAsk
}: {
  workspace?: Workspace;
  messages: ChatMessage[];
  evidence: EvidenceChunk[];
  question: string;
  setQuestion: (question: string) => void;
  loading: boolean;
  onAsk: () => void;
}) {
  const suggestedQuestions = [
    "这个领域最重要的材料体系和性能指标是什么？",
    "把方法路线按实验、仿真、机器学习分类。",
    "基于证据列出三个高价值研究假设。"
  ];

  return (
    <main className="chatPanel">
      <div className="panelHeader">
        <div>
          <span className="eyebrow">Codex Agent</span>
          <h2>Expert chat</h2>
        </div>
        <MessageSquareText size={20} />
      </div>

      <div className="promptRail">
        {suggestedQuestions.map((item) => (
          <button key={item} onClick={() => setQuestion(item)} disabled={!workspace || loading}>
            {item}
          </button>
        ))}
      </div>

      <div className="messages">
        {messages.map((message) => (
          <div className={`message ${message.role}`} key={message.id}>
            <span>{message.role === "user" ? "User" : "AI4S Codex"}</span>
            <p>{message.content}</p>
          </div>
        ))}
      </div>

      <div className="composer">
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && workspace && !loading) onAsk();
          }}
          placeholder={workspace ? "问材料体系、机理、数据缺口、实验路线..." : "先构建知识库"}
          disabled={!workspace || loading}
        />
        <button className="sendButton" onClick={onAsk} disabled={!workspace || loading || !question.trim()}>
          {loading ? <Loader2 className="spin" size={17} /> : <Send size={17} />}
        </button>
      </div>

      <div className="evidenceStrip">
        <strong>Evidence memory</strong>
        {(evidence.length ? evidence : workspace?.chunks?.slice(0, 3) || []).slice(0, 3).map((item) => (
          <article key={item.id}>
            <span>{item.kind}</span>
            <p>{item.text}</p>
            <small>{item.citation}</small>
          </article>
        ))}
      </div>
    </main>
  );
}

function ArtifactPanel({
  workspace,
  artifacts,
  loading,
  onGenerate
}: {
  workspace: Workspace;
  artifacts: Artifact[];
  loading: boolean;
  onGenerate: (kind: string) => void;
}) {
  const actions = [
    { kind: "report", label: "Research brief", detail: "investor-ready field readout", icon: <FileText size={17} /> },
    { kind: "materials-analysis", label: "Materials analysis", detail: "systems, properties, gaps", icon: <Braces size={17} /> },
    { kind: "codex-context", label: "Codex context", detail: "portable expert workspace", icon: <BrainCircuit size={17} /> },
    { kind: "graph-json", label: "Graph JSON", detail: "machine-readable graph", icon: <Network size={17} /> },
    { kind: "graph-mermaid", label: "Graph Mermaid", detail: "editable diagram source", icon: <GitBranch size={17} /> },
    { kind: "facts-csv", label: "Facts CSV", detail: "structured evidence table", icon: <Table2 size={17} /> }
  ];

  return (
    <section className="artifactPanel">
      <div className="panelHeader compact">
        <div>
          <span className="eyebrow">Model Outputs</span>
          <h2>Files</h2>
        </div>
        <Download size={20} />
      </div>

      <div className="artifactActions">
        {actions.map((action) => (
          <button key={action.kind} onClick={() => onGenerate(action.kind)} disabled={loading}>
            <span>{action.icon}</span>
            <strong>{action.label}</strong>
            <small>{action.detail}</small>
          </button>
        ))}
      </div>

      <div className="artifactList">
        {loading && <p>Generating file from {workspace.topic}...</p>}
        {artifacts.length ? (
          artifacts.map((artifact) => (
            <a key={artifact.filename} href={`${API_BASE}${artifact.url}`} target="_blank" rel="noreferrer">
              <Download size={16} />
              {artifact.filename}
            </a>
          ))
        ) : (
          <p>No files yet.</p>
        )}
      </div>
    </section>
  );
}

function PapersTable({ papers }: { papers: Paper[] }) {
  return (
    <div className="tableWrap">
      <table>
        <thead>
          <tr>
            <th>Paper</th>
            <th>Year</th>
            <th>Venue</th>
            <th>Concepts</th>
            <th>Cites</th>
          </tr>
        </thead>
        <tbody>
          {papers.map((paper) => (
            <tr key={paper.id}>
              <td>
                <strong>{paper.title}</strong>
                <small>{paper.authors || "Unknown authors"}</small>
              </td>
              <td>{paper.year ?? ""}</td>
              <td>{paper.venue ?? ""}</td>
              <td>{paper.labels.slice(0, 5).join(", ")}</td>
              <td>{paper.citationCount ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FactsTable({ workspace }: { workspace: Workspace }) {
  return (
    <div className="tableWrap">
      <table>
        <thead>
          <tr>
            <th>Subject</th>
            <th>Predicate</th>
            <th>Object</th>
            <th>Confidence</th>
          </tr>
        </thead>
        <tbody>
          {workspace.facts.slice(0, 180).map((fact) => (
            <tr key={fact.id}>
              <td>
                <strong>{fact.subject}</strong>
                <small>{fact.paperTitle || fact.paperId}</small>
              </td>
              <td>{fact.predicate}</td>
              <td>{fact.object}</td>
              <td>{Math.round(fact.confidence * 100)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GraphView({ nodes, edges }: { nodes: GraphNode[]; edges: GraphEdge[] }) {
  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  return (
    <div className="graphList">
      {edges.slice(0, 160).map((edge) => {
        const source = nodeById.get(edge.source);
        const target = nodeById.get(edge.target);
        return (
          <div className="graphEdge" key={edge.id}>
            <span>{source?.label || edge.source}</span>
            <code>{edge.label}</code>
            <span>{target?.label || edge.target}</span>
          </div>
        );
      })}
    </div>
  );
}

function DetailsShelf({ workspace }: { workspace: Workspace }) {
  const firstPaper = workspace.papers[0];
  return (
    <section className="detailsShelf">
      <details>
        <summary>
          <BookOpen size={17} />
          Source papers
        </summary>
        {firstPaper && (
          <article className="paperSpotlight">
            <strong>{firstPaper.title}</strong>
            <p>{firstPaper.abstract || "No abstract available from OpenAlex."}</p>
            <small>{citation(firstPaper)}</small>
          </article>
        )}
        <PapersTable papers={workspace.papers} />
      </details>

      <details>
        <summary>
          <Database size={17} />
          Full facts table
        </summary>
        <FactsTable workspace={workspace} />
      </details>

      <details>
        <summary>
          <Network size={17} />
          Graph edges
        </summary>
        <GraphView nodes={workspace.graph?.nodes || []} edges={workspace.graph?.edges || []} />
      </details>
    </section>
  );
}

function EmptyState({ onBuild, loading }: { onBuild: () => void; loading: boolean }) {
  return (
    <section className="emptyHero">
      <div className="emptyCopy">
        <span className="eyebrow">AI4S Knowledge Infrastructure</span>
        <h1>输入一个领域，生成专属 AI4S 模型工作台</h1>
        <div className="emptyFlow">
          <span>论文搜索</span>
          <span>知识库</span>
          <span>知识图谱</span>
          <span>模型工作台</span>
        </div>
        <button className="iconButton primary" onClick={onBuild} disabled={loading}>
          {loading ? <Loader2 className="spin" size={18} /> : <Play size={18} />}
          <span>Generate model</span>
        </button>
      </div>

      <div className="demoCanvas" aria-hidden="true">
        <div className="demoHeader">
          <span />
          <span />
          <span />
        </div>
        <div className="demoGrid">
          <article>
            <strong>45</strong>
            <small>papers</small>
          </article>
          <article>
            <strong>77</strong>
            <small>facts</small>
          </article>
          <article>
            <strong>142</strong>
            <small>graph nodes</small>
          </article>
        </div>
        <div className="demoGraph">
          <Network size={48} />
        </div>
        <div className="demoLine" />
        <div className="demoLine short" />
      </div>
    </section>
  );
}

export function App() {
  const [topic, setTopic] = useState(DEFAULT_TOPIC);
  const [limit, setLimit] = useState(45);
  const [fromYear, setFromYear] = useState(2018);
  const [workspace, setWorkspace] = useState<Workspace | undefined>();
  const [workspaceSummaries, setWorkspaceSummaries] = useState<WorkspaceSummaryInfo[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [health, setHealth] = useState<{ openaiConfigured: boolean; model: string } | undefined>();
  const [question, setQuestion] = useState("这个 topic 里面主要材料体系、方法路线和数据缺口是什么？");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [evidence, setEvidence] = useState<EvidenceChunk[]>([]);
  const [loading, setLoading] = useState(false);
  const [workMode, setWorkMode] = useState<WorkMode>("idle");
  const [buildTick, setBuildTick] = useState(0);
  const [chatLoading, setChatLoading] = useState(false);
  const [artifactLoading, setArtifactLoading] = useState(false);
  const [error, setError] = useState("");

  async function refreshWorkspaceSummaries() {
    const payload = await api<{ workspaces: WorkspaceSummaryInfo[] }>("/api/workspaces");
    setWorkspaceSummaries(payload.workspaces);
  }

  async function loadWorkspace(workspaceId: string) {
    setLoading(true);
    setWorkMode("loadingWorkspace");
    setError("");
    try {
      const payload = await api<{ workspace: Workspace; artifacts: Artifact[] }>(`/api/workspaces/${workspaceId}`);
      setWorkspace(payload.workspace);
      setArtifacts(payload.artifacts);
      setTopic(payload.workspace.topic);
      window.history.replaceState(null, "", `?workspace=${payload.workspace.id}`);
      setEvidence([]);
      setMessages([
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: `已加载历史知识库：${payload.workspace.topic}。包含 ${payload.workspace.papers.length} 篇论文、${payload.workspace.facts.length} 条 facts。`
        }
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load workspace");
    } finally {
      setLoading(false);
      setWorkMode("idle");
    }
  }

  async function buildKnowledgeBase() {
    setLoading(true);
    setWorkMode("building");
    setBuildTick(0);
    setError("");
    try {
      const payload = await api<{ workspace: Workspace; artifacts: Artifact[] }>("/api/workspaces", {
        method: "POST",
        body: JSON.stringify({ topic, limit, fromYear })
      });
      setWorkspace(payload.workspace);
      setArtifacts(payload.artifacts);
      window.history.replaceState(null, "", `?workspace=${payload.workspace.id}`);
      setEvidence([]);
      setMessages([
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: `知识库已建立：${payload.workspace.papers.length} 篇论文，${payload.workspace.entities.length} 个实体，${payload.workspace.facts.length} 条结构化事实，${payload.workspace.graph?.edges.length ?? 0} 条图谱边。`
        }
      ]);
      await refreshWorkspaceSummaries();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to build workspace");
    } finally {
      setLoading(false);
      setWorkMode("idle");
    }
  }

  async function ask() {
    if (!workspace || !question.trim()) return;
    const currentQuestion = question.trim();
    setChatLoading(true);
    setError("");
    setMessages((current) => [...current, { id: `user-${Date.now()}`, role: "user", content: currentQuestion }]);
    try {
      const payload = await api<{ answer: string; evidence: EvidenceChunk[]; model: string }>(
        `/api/workspaces/${workspace.id}/chat`,
        {
          method: "POST",
          body: JSON.stringify({ message: currentQuestion })
        }
      );
      setEvidence(payload.evidence);
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: `${payload.answer}\n\nModel: ${payload.model}`
        }
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to ask");
    } finally {
      setChatLoading(false);
    }
  }

  async function generateArtifact(kind: string) {
    if (!workspace) return;
    setArtifactLoading(true);
    setError("");
    try {
      const payload = await api<{ artifact: Artifact }>(`/api/workspaces/${workspace.id}/artifacts`, {
        method: "POST",
        body: JSON.stringify({ kind })
      });
      setArtifacts((current) => {
        const withoutDuplicate = current.filter((artifact) => artifact.filename !== payload.artifact.filename);
        return [...withoutDuplicate, payload.artifact];
      });
      await refreshWorkspaceSummaries();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate artifact");
    } finally {
      setArtifactLoading(false);
    }
  }

  useEffect(() => {
    async function bootstrap() {
      try {
        const healthPayload = await api<{ ok: boolean; openaiConfigured: boolean; model: string }>("/api/health");
        setHealth(healthPayload);
        const summariesPayload = await api<{ workspaces: WorkspaceSummaryInfo[] }>("/api/workspaces");
        setWorkspaceSummaries(summariesPayload.workspaces);
        const workspaceId = new URLSearchParams(window.location.search).get("workspace");
        if (workspaceId) {
          await loadWorkspace(workspaceId);
        }
      } catch {
        setError("Backend is not running. Start it with npm run dev.");
      }
    }
    bootstrap();
  }, []);

  useEffect(() => {
    if (workMode !== "building") return;
    const timer = window.setInterval(() => {
      setBuildTick((current) => current + 1);
    }, 850);
    return () => window.clearInterval(timer);
  }, [workMode]);

  return (
    <div className="appShell">
      <TopBar
        topic={topic}
        setTopic={setTopic}
        limit={limit}
        setLimit={setLimit}
        fromYear={fromYear}
        setFromYear={setFromYear}
        health={health}
        loading={loading}
        mode={workMode}
        onBuild={buildKnowledgeBase}
      />
      {error && <div className="errorBanner">{error}</div>}

      <ProcessFlow topic={topic} workspace={workspace} artifacts={artifacts} mode={workMode} buildTick={buildTick} />
      <WorkspaceHistory
        workspaces={workspaceSummaries}
        activeId={workspace?.id}
        loading={loading}
        onLoad={loadWorkspace}
      />

      {!workspace ? (
        <EmptyState onBuild={buildKnowledgeBase} loading={loading} />
      ) : (
        <>
          <div className="primaryGrid">
            <KnowledgeStage workspace={workspace} />
            <ChatPanel
              workspace={workspace}
              messages={messages}
              evidence={evidence}
              question={question}
              setQuestion={setQuestion}
              loading={chatLoading}
              onAsk={ask}
            />
          </div>

          <ArtifactPanel
            workspace={workspace}
            artifacts={artifacts}
            loading={artifactLoading}
            onGenerate={generateArtifact}
          />

          <DetailsShelf workspace={workspace} />
        </>
      )}
    </div>
  );
}
