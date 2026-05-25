import {
  BookOpen,
  Boxes,
  Braces,
  BrainCircuit,
  Database,
  Download,
  FileText,
  GitBranch,
  Loader2,
  MessageSquareText,
  Network,
  Play,
  Send,
  Table2
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Artifact, ChatMessage, EvidenceChunk, GraphEdge, GraphNode, Paper, Workspace, WorkspaceSummaryInfo } from "./types";

type Tab = "map" | "papers" | "facts" | "graph" | "artifacts";

const API_BASE = import.meta.env.VITE_API_BASE || (import.meta.env.DEV ? "http://localhost:8787" : "");
const DEFAULT_TOPIC = "solid-state electrolyte AI agents for materials discovery";

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
  onBuild: () => void;
}) {
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brandMark">
          <BrainCircuit size={20} />
        </div>
        <div>
          <strong>AI4S Knowledge Codex</strong>
          <span>Topic → literature KB → knowledge graph → Codex outputs</span>
        </div>
      </div>

      <label className="topicInput">
        <Network size={17} />
        <input
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
          placeholder="Enter a scientific topic"
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
        <span>{loading ? "Building" : "Build KB"}</span>
      </button>

      <div className={`healthBadge ${health?.openaiConfigured ? "ready" : "fallback"}`}>
        {health?.openaiConfigured ? "OpenAI ready" : "Local fallback"}
        <span>{health?.model || "checking"}</span>
      </div>
    </header>
  );
}

function WorkspaceSummary({ workspace }: { workspace?: Workspace }) {
  const graph = workspace?.graph;
  return (
    <section className="metricsStrip">
      <div>
        <span>{workspace?.papers.length ?? 0}</span>
        <small>Papers</small>
      </div>
      <div>
        <span>{workspace?.entities.length ?? 0}</span>
        <small>Entities</small>
      </div>
      <div>
        <span>{workspace?.facts.length ?? 0}</span>
        <small>Facts</small>
      </div>
      <div>
        <span>{graph?.edges.length ?? 0}</span>
        <small>Graph edges</small>
      </div>
    </section>
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
    <section className="workspaceHistory">
      <div>
        <strong>Recent workspaces</strong>
        <span>{workspaces.length} saved locally</span>
      </div>
      <div className="workspaceChips">
        {workspaces.slice(0, 8).map((item) => (
          <button
            key={item.id}
            className={item.id === activeId ? "active" : ""}
            onClick={() => onLoad(item.id)}
            disabled={loading}
          >
            <span>{item.topic}</span>
            <small>{item.paperCount} papers · {item.factCount} facts</small>
          </button>
        ))}
      </div>
    </section>
  );
}

function PaperBrowser({
  papers,
  activePaperId,
  setActivePaperId
}: {
  papers: Paper[];
  activePaperId?: string;
  setActivePaperId: (id: string) => void;
}) {
  return (
    <aside className="sidebar">
      <div className="panelHeader">
        <div>
          <span className="eyebrow">Auto Literature</span>
          <h2>{papers.length} OpenAlex papers</h2>
        </div>
        <BookOpen size={19} />
      </div>
      <div className="paperList">
        {papers.map((paper) => (
          <button
            className={`paperRow ${paper.id === activePaperId ? "selected" : ""}`}
            key={paper.id}
            onClick={() => setActivePaperId(paper.id)}
          >
            <span>{paper.title}</span>
            <small>
              {paper.year ?? "n.d."} · {paper.venue || "unknown venue"} · {paper.citationCount ?? 0} cites
            </small>
          </button>
        ))}
      </div>
    </aside>
  );
}

function ChatPanel({
  workspace,
  messages,
  question,
  setQuestion,
  loading,
  onAsk
}: {
  workspace?: Workspace;
  messages: ChatMessage[];
  question: string;
  setQuestion: (question: string) => void;
  loading: boolean;
  onAsk: () => void;
}) {
  return (
    <main className="chatPanel">
      <div className="panelHeader">
        <div>
          <span className="eyebrow">Codex Agent</span>
          <h2>Grounded scientific analysis</h2>
        </div>
        <MessageSquareText size={20} />
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
          placeholder={workspace ? "Ask about this generated knowledge base" : "Build a knowledge base first"}
          disabled={!workspace || loading}
        />
        <button className="sendButton" onClick={onAsk} disabled={!workspace || loading || !question.trim()}>
          {loading ? <Loader2 className="spin" size={17} /> : <Send size={17} />}
        </button>
      </div>

      <div className="toolTrace">
        <strong>Backend tools</strong>
        <code>OpenAlex search</code>
        <code>build_kb</code>
        <code>retrieve</code>
        <code>OpenAI responses</code>
      </div>
    </main>
  );
}

function EvidencePanel({ workspace, activePaper, evidence }: { workspace?: Workspace; activePaper?: Paper; evidence: EvidenceChunk[] }) {
  return (
    <aside className="evidencePanel">
      <div className="panelHeader">
        <div>
          <span className="eyebrow">Evidence</span>
          <h2>Sources and graph context</h2>
        </div>
        <Database size={19} />
      </div>

      {activePaper ? (
        <section className="activePaper">
          <h3>{activePaper.title}</h3>
          <p>{activePaper.abstract || "No abstract available from OpenAlex."}</p>
          <small>{citation(activePaper)}</small>
        </section>
      ) : (
        <section className="emptyState small">
          <Boxes size={28} />
          <p>Build a topic workspace to see retrieved sources.</p>
        </section>
      )}

      <div className="evidenceList">
        {(evidence.length ? evidence : workspace?.chunks?.slice(0, 8) || []).map((item) => (
          <article className="evidenceItem" key={item.id}>
            <div>
              <strong>{item.kind}</strong>
              {"score" in item && <span>{Number(item.score || 0).toFixed(1)}</span>}
            </div>
            <p>{item.text}</p>
            <small>{item.citation}</small>
          </article>
        ))}
      </div>
    </aside>
  );
}

function ResearchMap({ workspace }: { workspace: Workspace }) {
  const max = Math.max(...workspace.clusters.map((cluster) => cluster.paperIds.length), 1);
  return (
    <div className="tabContent mapGrid">
      {workspace.clusters.map((cluster) => (
        <section className="clusterBand" key={cluster.id}>
          <div className="clusterTop">
            <div>
              <h3>{cluster.label}</h3>
              <p>{cluster.terms.join(" · ")}</p>
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

function PapersTable({ papers }: { papers: Paper[] }) {
  return (
    <div className="tabContent tableWrap">
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
    <div className="tabContent tableWrap">
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
          {workspace.facts.map((fact) => (
            <tr key={fact.id}>
              <td>
                <strong>{fact.subject}</strong>
                <small>{fact.paperId}</small>
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
    <div className="tabContent graphList">
      {edges.slice(0, 120).map((edge) => {
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
  return (
    <div className="tabContent artifactGrid">
      <section className="artifactActions">
        <button onClick={() => onGenerate("report")} disabled={loading}>
          <FileText size={17} />
          Research brief
        </button>
        <button onClick={() => onGenerate("materials-analysis")} disabled={loading}>
          <Braces size={17} />
          Materials analysis
        </button>
        <button onClick={() => onGenerate("codex-context")} disabled={loading}>
          <BrainCircuit size={17} />
          Codex context
        </button>
        <button onClick={() => onGenerate("graph-json")} disabled={loading}>
          <Network size={17} />
          Graph JSON
        </button>
        <button onClick={() => onGenerate("graph-mermaid")} disabled={loading}>
          <GitBranch size={17} />
          Graph Mermaid
        </button>
        <button onClick={() => onGenerate("facts-csv")} disabled={loading}>
          <Table2 size={17} />
          Facts CSV
        </button>
      </section>

      <section className="artifactList">
        <h3>Generated files for {workspace.topic}</h3>
        {loading && <p>Generating file from the current knowledge base...</p>}
        {artifacts.length ? (
          artifacts.map((artifact) => (
            <a key={artifact.filename} href={`${API_BASE}${artifact.url}`} target="_blank" rel="noreferrer">
              <Download size={16} />
              {artifact.filename}
            </a>
          ))
        ) : (
          <p>No artifacts yet. Generate a report, graph, or facts file.</p>
        )}
      </section>
    </div>
  );
}

function EmptyState({ onBuild, loading }: { onBuild: () => void; loading: boolean }) {
  return (
    <section className="emptyHero">
      <Network size={44} />
      <h1>Build a topic-specific AI4S knowledge base</h1>
      <p>
        Enter a scientific topic. The backend searches OpenAlex, builds a local literature KB, derives entities and facts,
        creates a knowledge graph, then lets OpenAI generate grounded analysis and files.
      </p>
      <button className="iconButton primary" onClick={onBuild} disabled={loading}>
        {loading ? <Loader2 className="spin" size={18} /> : <Play size={18} />}
        <span>Build first workspace</span>
      </button>
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
  const [activePaperId, setActivePaperId] = useState<string | undefined>();
  const [activeTab, setActiveTab] = useState<Tab>("map");
  const [question, setQuestion] = useState("这个 topic 里面主要材料体系、方法路线和数据缺口是什么？");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [evidence, setEvidence] = useState<EvidenceChunk[]>([]);
  const [loading, setLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [artifactLoading, setArtifactLoading] = useState(false);
  const [error, setError] = useState("");

  const activePaper = useMemo(
    () => workspace?.papers.find((paper) => paper.id === activePaperId) || workspace?.papers[0],
    [workspace, activePaperId]
  );

  async function refreshWorkspaceSummaries() {
    const payload = await api<{ workspaces: WorkspaceSummaryInfo[] }>("/api/workspaces");
    setWorkspaceSummaries(payload.workspaces);
  }

  async function loadWorkspace(workspaceId: string) {
    setLoading(true);
    setError("");
    try {
      const payload = await api<{ workspace: Workspace; artifacts: Artifact[] }>(`/api/workspaces/${workspaceId}`);
      setWorkspace(payload.workspace);
      setArtifacts(payload.artifacts);
      setTopic(payload.workspace.topic);
      setActivePaperId(payload.workspace.papers[0]?.id);
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
    }
  }

  async function buildKnowledgeBase() {
    setLoading(true);
    setError("");
    try {
      const payload = await api<{ workspace: Workspace; artifacts: Artifact[] }>("/api/workspaces", {
        method: "POST",
        body: JSON.stringify({ topic, limit, fromYear })
      });
      setWorkspace(payload.workspace);
      setArtifacts(payload.artifacts);
      setActivePaperId(payload.workspace.papers[0]?.id);
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
      setActiveTab("artifacts");
      await refreshWorkspaceSummaries();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate artifact");
    } finally {
      setArtifactLoading(false);
    }
  }

  useEffect(() => {
    api<{ ok: boolean; openaiConfigured: boolean; model: string }>("/api/health")
      .then((payload) => setHealth(payload))
      .then(() => refreshWorkspaceSummaries())
      .catch(() => {
        setError("Backend is not running. Start it with npm run dev.");
      });
  }, []);

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
        onBuild={buildKnowledgeBase}
      />
      {error && <div className="errorBanner">{error}</div>}
      <WorkspaceSummary workspace={workspace} />
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
          <div className="workbench">
            <PaperBrowser papers={workspace.papers} activePaperId={activePaper?.id} setActivePaperId={setActivePaperId} />
            <ChatPanel
              workspace={workspace}
              messages={messages}
              question={question}
              setQuestion={setQuestion}
              loading={chatLoading}
              onAsk={ask}
            />
            <EvidencePanel workspace={workspace} activePaper={activePaper} evidence={evidence} />
          </div>

          <section className="lowerWorkbench">
            <nav className="tabs" aria-label="Workspace tabs">
              <button className={activeTab === "map" ? "active" : ""} onClick={() => setActiveTab("map")}>
                <GitBranch size={16} />
                Research Map
              </button>
              <button className={activeTab === "papers" ? "active" : ""} onClick={() => setActiveTab("papers")}>
                <BookOpen size={16} />
                Papers
              </button>
              <button className={activeTab === "facts" ? "active" : ""} onClick={() => setActiveTab("facts")}>
                <Table2 size={16} />
                Facts
              </button>
              <button className={activeTab === "graph" ? "active" : ""} onClick={() => setActiveTab("graph")}>
                <Network size={16} />
                Knowledge Graph
              </button>
              <button className={activeTab === "artifacts" ? "active" : ""} onClick={() => setActiveTab("artifacts")}>
                <Download size={16} />
                Artifacts
              </button>
            </nav>

            {activeTab === "map" && <ResearchMap workspace={workspace} />}
            {activeTab === "papers" && <PapersTable papers={workspace.papers} />}
            {activeTab === "facts" && <FactsTable workspace={workspace} />}
            {activeTab === "graph" && (
              <GraphView nodes={workspace.graph?.nodes || []} edges={workspace.graph?.edges || []} />
            )}
            {activeTab === "artifacts" && (
              <ArtifactPanel
                workspace={workspace}
                artifacts={artifacts}
                loading={artifactLoading}
                onGenerate={generateArtifact}
              />
            )}
          </section>
        </>
      )}
    </div>
  );
}
