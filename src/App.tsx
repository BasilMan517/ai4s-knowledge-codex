import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, type SimulationNodeDatum, type SimulationLinkDatum } from "d3-force";
import { demoPapers } from "./data/demoCorpus";
import { buildWorkspace } from "./lib/search";
import type { ChatMessage, GraphEdge, Workspace } from "./types";
import "./styles.css";

type Phase = "home" | "process";

const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ||
  "http://127.0.0.1:8787";

const colors: Record<string, string> = {
  material: "#7fbfcc",
  method: "#c26e55",
  property: "#7db889",
  task: "#a68ad4",
  dataset: "#cc9d4f",
  system: "#6da6d4",
  model: "#d48aaf",
  topic: "#e8e8ec",
  paper: "#8a8a96",
  concept: "#a68ad4"
};

const workflow = [
  { num: "01", title: "Paper Discovery", desc: "Search and retrieve papers from OpenAlex, building a curated corpus." },
  { num: "02", title: "Entity Extraction", desc: "Identify materials, methods, properties and other entities from abstracts." },
  { num: "03", title: "Knowledge Graph", desc: "Link entities with structured facts and build an interactive graph." },
  { num: "04", title: "Research Chat", desc: "Ask grounded questions — answers are cited against your knowledge base." },
];

type LayoutNode = {
  id: string;
  name: string;
  type: string;
  x: number;
  y: number;
  r: number;
};

type ForceNode = SimulationNodeDatum & LayoutNode;
type ForceEdge = SimulationLinkDatum<ForceNode> & { label: string };

function selectGraphNodes(workspace: Workspace): { nodes: LayoutNode[]; edges: { source: string; target: string; label: string }[] } {
  if (!workspace.graph || workspace.graph.nodes.length === 0) {
    const entities = workspace.entities.slice(0, 20);
    const nodes: LayoutNode[] = entities.map(e => ({ id: e.id, name: e.name, type: e.type, x: 0, y: 0, r: 10 }));
    const edges = entities.map(e => ({ source: entities[0]?.id || "", target: e.id, label: "" }));
    return { nodes, edges };
  }

  const allNodes = workspace.graph.nodes;
  const allEdges = workspace.graph.edges;

  const entityNodes = allNodes.filter(n => n.type !== "paper");
  const paperNodes = allNodes.filter(n => n.type === "paper");

  const entityIds = new Set(entityNodes.map(n => n.id));
  const paperEdgeCount = new Map<string, number>();
  for (const e of allEdges) {
    if (entityIds.has(e.target)) {
      paperEdgeCount.set(e.source, (paperEdgeCount.get(e.source) || 0) + 1);
    }
    if (entityIds.has(e.source)) {
      paperEdgeCount.set(e.target, (paperEdgeCount.get(e.target) || 0) + 1);
    }
  }

  const topPapers = paperNodes
    .filter(p => (paperEdgeCount.get(p.id) || 0) > 0)
    .sort((a, b) => (paperEdgeCount.get(b.id) || 0) - (paperEdgeCount.get(a.id) || 0))
    .slice(0, 25);

  const selectedNodes = [...entityNodes, ...topPapers];
  const selectedIds = new Set(selectedNodes.map(n => n.id));

  const nodes: LayoutNode[] = selectedNodes.map(n => ({
    id: n.id,
    name: n.label,
    type: n.type,
    x: 0,
    y: 0,
    r: n.type === "paper" ? 5 : Math.min(14, 8 + (n.count || 0))
  }));

  const edges = allEdges
    .filter((e: GraphEdge) => selectedIds.has(e.source) && selectedIds.has(e.target))
    .map((e: GraphEdge) => ({ source: e.source, target: e.target, label: e.label }));

  return { nodes, edges };
}

function runForceLayout(
  inputNodes: LayoutNode[],
  inputEdges: { source: string; target: string; label: string }[],
  width: number,
  height: number
): { nodes: LayoutNode[]; edges: { source: string; target: string; label: string }[] } {
  if (inputNodes.length === 0) return { nodes: [], edges: [] };

  const simNodes: ForceNode[] = inputNodes.map(n => ({
    ...n,
    x: width / 2 + (Math.random() - 0.5) * width * 0.6,
    y: height / 2 + (Math.random() - 0.5) * height * 0.6
  }));

  const nodeById = new Map(simNodes.map(n => [n.id, n]));
  const simEdges: ForceEdge[] = inputEdges
    .filter(e => nodeById.has(e.source) && nodeById.has(e.target))
    .map(e => ({ source: e.source, target: e.target, label: e.label }));

  const sim = forceSimulation<ForceNode>(simNodes)
    .force("link", forceLink<ForceNode, ForceEdge>(simEdges).id(d => d.id).distance(80).strength(0.4))
    .force("charge", forceManyBody<ForceNode>().strength(-200))
    .force("center", forceCenter(width / 2, height / 2))
    .force("collide", forceCollide<ForceNode>().radius(d => d.r + 8))
    .stop();

  for (let i = 0; i < 200; i++) sim.tick();

  const pad = 30;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const n of simNodes) {
    if (n.x! < minX) minX = n.x!;
    if (n.x! > maxX) maxX = n.x!;
    if (n.y! < minY) minY = n.y!;
    if (n.y! > maxY) maxY = n.y!;
  }
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  const scale = Math.min((width - pad * 2) / rangeX, (height - pad * 2) / rangeY, 1.5);

  const cx = width / 2;
  const cy = height / 2;
  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;

  const layoutNodes: LayoutNode[] = simNodes.map(n => ({
    id: n.id,
    name: n.name,
    type: n.type,
    r: n.r,
    x: cx + (n.x! - midX) * scale,
    y: cy + (n.y! - midY) * scale
  }));

  return { nodes: layoutNodes, edges: inputEdges };
}

function Home({ onStart, loading, error }: { onStart: (topic: string) => void; loading: boolean; error: string | null }) {
  const [topic, setTopic] = useState("");

  const handleSubmit = () => {
    const t = topic.trim();
    if (t && !loading) onStart(t);
  };

  return (
    <div className="home-container">
      <nav className="navbar">
        <div className="nav-brand">N.E.R.D</div>
        <div className="nav-status">
          <span className="nav-chip">MIROFISH SHELL</span>
          <span className="nav-chip">CODEX READY</span>
        </div>
      </nav>

      <div className="main-content">
        <div className="hero-section">
          <div className="hero-left">
            <div className="tag-row">
              <span className="orange-tag">AI4S</span>
              <span className="version-text">v0.1 PREVIEW</span>
            </div>
            <h1 className="main-title">
              Build your
              <br />
              <span className="gradient-text">research expert.</span>
            </h1>
            <p className="hero-desc">
              <span className="highlight-bold">N.E.R.D</span> searches <span className="highlight-orange">50+</span> papers
              from OpenAlex, extracts entities and structured facts, builds a knowledge graph,
              and gives you a grounded research chat — all in one workspace.
            </p>
            <p className="slogan-text">Enter a topic. Get an expert.<span className="blinking-cursor">|</span></p>
            <div className="decoration-square" />
          </div>

          <div className="right-panel">
            <div className="console-box">
              <div className="console-section">
                <div className="console-header">
                  <span>RESEARCH SEED</span>
                  <span>TOPIC INPUT</span>
                </div>
                <div className="input-wrapper">
                  <textarea
                    className="code-input"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmit();
                      }
                    }}
                    placeholder="e.g. solid-state lithium batteries with halide electrolytes&#10;&#10;Supports English and Chinese topics"
                    disabled={loading}
                  />
                  <span className="model-badge">OpenAlex + LLM</span>
                </div>
              </div>
              {error && (
                <div className="console-section" style={{ paddingTop: 0 }}>
                  <div className="error-banner">
                    <span>ERROR</span> {error}
                  </div>
                </div>
              )}
              <div className="console-section btn-section">
                <button
                  className="start-engine-btn"
                  onClick={handleSubmit}
                  disabled={loading || !topic.trim()}
                >
                  <span>{loading ? "BUILDING WORKSPACE..." : "START ENGINE"}</span>
                  <span>→</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="dashboard-section">
          <div>
            <div className="panel-header">
              <span className="status-dot">◆</span> WORKFLOW
            </div>
            <h2 className="section-title">How it works</h2>
            <p className="section-desc">
              From topic to knowledge graph in four automated steps.
            </p>
            <div className="metrics-row">
              <div className="metric-card">
                <div className="metric-value">50+</div>
                <div className="metric-label">Papers</div>
              </div>
              <div className="metric-card">
                <div className="metric-value">~200</div>
                <div className="metric-label">Facts</div>
              </div>
              <div className="metric-card">
                <div className="metric-value">1</div>
                <div className="metric-label">Expert</div>
              </div>
            </div>
          </div>

          <div className="steps-container">
            <div className="steps-header">
              <span className="status-dot">◆</span> PIPELINE STEPS
            </div>
            <div className="workflow-list">
              {workflow.map((step) => (
                <div className="workflow-item" key={step.num}>
                  <span className="step-num">{step.num}</span>
                  <div className="step-info">
                    <div className="step-title">{step.title}</div>
                    <div className="step-desc">{step.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Process({
  workspace,
}: {
  workspace: Workspace;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [citedPaperIds, setCitedPaperIds] = useState<Set<string>>(new Set());
  const [visibleCount, setVisibleCount] = useState(0);
  const [dragId, setDragId] = useState<string | null>(null);
  const [nodePositions, setNodePositions] = useState<Map<string, { x: number; y: number }>>(new Map());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const isEmpty = workspace.papers.length === 0 && workspace.entities.length === 0;

  const { nodes: rawNodes, edges: rawEdges } = useMemo(
    () => selectGraphNodes(workspace),
    [workspace]
  );

  const { nodes: forceNodes, edges: graphEdges } = useMemo(
    () => runForceLayout(rawNodes, rawEdges, 840, 460),
    [rawNodes, rawEdges]
  );

  const graphNodes = useMemo(() => {
    if (nodePositions.size === 0) return forceNodes;
    return forceNodes.map(n => {
      const pos = nodePositions.get(n.id);
      return pos ? { ...n, x: pos.x, y: pos.y } : n;
    });
  }, [forceNodes, nodePositions]);

  useEffect(() => {
    setVisibleCount(0);
    setNodePositions(new Map());
    if (graphNodes.length === 0) return;
    let count = 0;
    const total = graphNodes.length;
    const interval = setInterval(() => {
      count += Math.max(1, Math.floor(total / 20));
      if (count >= total) {
        setVisibleCount(total);
        clearInterval(interval);
      } else {
        setVisibleCount(count);
      }
    }, 60);
    return () => clearInterval(interval);
  }, [forceNodes.length]);

  const selected = graphNodes.find((n) => n.id === selectedId) ?? null;

  const citedNodeIds = useMemo(() => {
    if (citedPaperIds.size === 0) return new Set<string>();
    const ids = new Set<string>(citedPaperIds);
    for (const entity of workspace.entities) {
      if (entity.paperIds.some(pid => citedPaperIds.has(pid))) {
        ids.add(entity.id);
      }
    }
    return ids;
  }, [citedPaperIds, workspace]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages, chatLoading, scrollToBottom]);

  const sendMessage = useCallback(async (text: string) => {
    const msg = text.trim();
    if (!msg || chatLoading || !workspace?.id) return;

    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", content: msg };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput("");
    setChatLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/workspaces/${workspace.id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg })
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      const pIds: string[] = [...new Set((data.evidence || []).map((e: { paperId: string }) => e.paperId).filter(Boolean))] as string[];
      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: data.answer || "No response received.",
        evidenceIds: data.evidence?.map((e: { id: string }) => e.id),
        paperIds: pIds
      };
      setChatMessages(prev => [...prev, assistantMsg]);
      setCitedPaperIds(new Set(pIds));
    } catch (err) {
      setChatMessages(prev => [...prev, {
        id: `e-${Date.now()}`,
        role: "assistant",
        content: `Error: ${err instanceof Error ? err.message : "Failed to reach server"}. Make sure the backend is running.`
      }]);
    } finally {
      setChatLoading(false);
    }
  }, [chatLoading, workspace?.id]);

  const suggestions = useMemo(() => [
    `What are the key findings in ${workspace.topic.split(" ").slice(0, 4).join(" ")}?`,
    "What methods are most commonly used?",
    "Summarize the main research gaps",
    "What materials or datasets are studied?"
  ], [workspace]);

  const nodeMap = useMemo(() => {
    const m = new Map<string, LayoutNode>();
    for (const n of graphNodes) m.set(n.id, n);
    return m;
  }, [graphNodes]);

  const handlePointerDown = useCallback((e: React.PointerEvent, nodeId: string) => {
    e.stopPropagation();
    setDragId(nodeId);
    (e.target as Element).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragId || !svgRef.current) return;
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const svgPt = pt.matrixTransform(ctm.inverse());
    setNodePositions(prev => {
      const next = new Map(prev);
      next.set(dragId, { x: svgPt.x, y: svgPt.y });
      return next;
    });
  }, [dragId]);

  const handlePointerUp = useCallback(() => {
    setDragId(null);
  }, []);

  return (
    <div className="process-page">
      <nav className="navbar">
        <div className="nav-brand">N.E.R.D</div>
        <div className="nav-center">
          <div className="step-badge">WORKSPACE</div>
          <div className="step-name">{workspace.topic.length > 50 ? workspace.topic.slice(0, 48) + "..." : workspace.topic}</div>
        </div>
        <div className="nav-status">
          <span className="status-dot-round complete" />
          <span className="status-text">{workspace.papers.length} papers / {workspace.entities.length} entities</span>
        </div>
      </nav>

      <main className="process-content-main">
        <section className="graph-shell">
          <div className="panel-header graph-header">
            <div className="header-left">
              <span className="header-deco">◆</span>
              <span className="header-title">Knowledge Graph</span>
            </div>
            {workspace && (
              <div className="header-right">
                <span className="stat-item">{graphNodes.length} nodes</span>
                <span className="stat-divider">|</span>
                <span className="stat-item">{graphEdges.length} edges</span>
                <span className="stat-divider">|</span>
                <span className="stat-item">{workspace.facts.length} facts</span>
              </div>
            )}
          </div>

          <div className="graph-container">
            {isEmpty ? (
              <div className="graph-empty">
                <div className="graph-empty-icon">∅</div>
                <div className="graph-empty-title">No papers found</div>
                <div className="graph-empty-desc">
                  Try a different topic or use English keywords for better results.
                </div>
              </div>
            ) : (
              <>
            <svg
              className="graph-svg"
              viewBox="0 0 840 460"
              ref={svgRef}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
            >
              {graphEdges.map((edge, i) => {
                const s = nodeMap.get(edge.source);
                const t = nodeMap.get(edge.target);
                if (!s || !t) return null;
                const si = graphNodes.indexOf(s);
                const ti = graphNodes.indexOf(t);
                if (si >= visibleCount || ti >= visibleCount) return null;
                const isHighlighted = (selectedId && (edge.source === selectedId || edge.target === selectedId))
                  || (citedNodeIds.size > 0 && citedNodeIds.has(edge.source) && citedNodeIds.has(edge.target));
                const mx = (s.x + t.x) / 2;
                const my = (s.y + t.y) / 2;
                const isDimEdge = citedNodeIds.size > 0 && !isHighlighted;
                return (
                  <g key={`e-${i}`} className="edge-group-enter">
                    <line
                      x1={s.x} y1={s.y}
                      x2={t.x} y2={t.y}
                      className={isHighlighted ? "edge selected" : isDimEdge ? "edge dimmed" : "edge"}
                    />
                    {edge.label && isHighlighted && (
                      <text x={mx} y={my - 4} className="edge-label" textAnchor="middle">
                        {edge.label.length > 20 ? edge.label.slice(0, 18) + "..." : edge.label}
                      </text>
                    )}
                  </g>
                );
              })}
              {graphNodes.map((node, i) => {
                if (i >= visibleCount) return null;
                const color = colors[node.type] || "#888";
                const isSelected = selectedId === node.id;
                const isCited = citedNodeIds.has(node.id);
                const isDragging = dragId === node.id;
                const dimmed = citedNodeIds.size > 0 && !isCited && !isSelected;
                return (
                  <g
                    key={node.id}
                    className={`svg-node node-enter ${isSelected ? "selected" : ""} ${isCited ? "cited" : ""} ${dimmed ? "dimmed" : ""} ${isDragging ? "dragging" : ""}`}
                    transform={`translate(${node.x} ${node.y})`}
                    onClick={() => { if (!isDragging) setSelectedId(isSelected ? null : node.id); }}
                    onPointerDown={(e) => handlePointerDown(e, node.id)}
                    style={{ animationDelay: `${i * 30}ms` }}
                  >
                    <circle r={node.r * 1.8} fill={color} opacity={0.06} />
                    <circle r={node.r} fill={color} />
                    {node.r > 8 && <circle r={2} fill="white" opacity={0.5} />}
                    <text
                      x={node.r + 6}
                      y={4}
                      textAnchor="start"
                      className={isCited ? "cited-text" : ""}
                    >
                      {node.name.length > 24 ? `${node.name.slice(0, 22)}...` : node.name}
                    </text>
                  </g>
                );
              })}
            </svg>

            {selected && (
              <div className="detail-panel">
                <div className="detail-panel-header">
                  <span className="detail-title">Node Details</span>
                  <span className="detail-badge" style={{ background: colors[selected.type] || "#888" }}>
                    {selected.type}
                  </span>
                </div>
                <div className="detail-content">
                  <div className="detail-row">
                    <span className="detail-label">Name:</span>
                    <span className="detail-value highlight">{selected.name}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Edges:</span>
                    <span className="detail-value">{graphEdges.filter(e => e.source === selected.id || e.target === selected.id).length} connections</span>
                  </div>
                  {selected.type !== "topic" && (
                    <div className="detail-section">
                      <span className="detail-label">Related:</span>
                      <p className="detail-summary">
                        {graphEdges
                          .filter(e => e.source === selected.id || e.target === selected.id)
                          .slice(0, 3)
                          .map(e => {
                            const otherId = e.source === selected.id ? e.target : e.source;
                            const other = nodeMap.get(otherId);
                            return other ? other.name : otherId;
                          })
                          .join(", ") || "No direct connections"}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
              </>
            )}
          </div>

          <div className="graph-legend">
            {Object.entries(colors)
              .filter(([type]) => type !== "topic" && type !== "paper")
              .map(([type, color]) => (
                <div className="legend-item" key={type}>
                  <span className="legend-dot" style={{ background: color }} />
                  <span className="legend-label">{type}</span>
                </div>
              ))}
          </div>
        </section>

        <aside className="chat-panel">
          <div className="chat-header">
            <span className="chat-header-title">
              <span className="header-deco">▣</span> Research Chat
            </span>
            <span className="chat-header-meta">{workspace.id ? "LIVE" : "LOCAL"}</span>
          </div>

          {chatMessages.length === 0 && !chatLoading ? (
            <div className="chat-welcome">
              <div className="chat-welcome-icon">◇</div>
              <div className="chat-welcome-title">Ask your research expert</div>
              <div className="chat-welcome-desc">
                This workspace has {workspace.papers.length} papers and {workspace.entities.length} entities. Ask any question and get answers grounded in the literature.
              </div>
            </div>
          ) : (
            <div className="chat-messages">
              {chatMessages.map((msg) => (
                <div key={msg.id} className={`chat-bubble ${msg.role}`}>
                  {msg.content}
                </div>
              ))}
              {chatLoading && (
                <div className="typing-indicator">
                  <span /><span /><span />
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}

          {chatMessages.length === 0 && !chatLoading && (
            <div className="chat-suggestions">
              {suggestions.map((s, i) => (
                <button key={i} className="suggestion-chip" onClick={() => sendMessage(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}

          <div className="chat-input-bar">
            <textarea
              className="chat-input"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(chatInput);
                }
              }}
              placeholder="Ask a research question..."
              rows={1}
              disabled={chatLoading}
            />
            <button
              className="chat-send-btn"
              onClick={() => sendMessage(chatInput)}
              disabled={chatLoading || !chatInput.trim()}
            >
              SEND
            </button>
          </div>
        </aside>
      </main>
    </div>
  );
}

export default function App() {
  const [phase, setPhase] = useState<Phase>("home");
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start(topic: string) {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/workspaces`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim() || "AI for scientific discovery", limit: 50, fromYear: 2018 })
      });
      if (!response.ok) throw new Error(`Server returned ${response.status}`);
      const data = (await response.json()) as { workspace?: Workspace };
      if (!data.workspace) throw new Error("No workspace in response");
      setWorkspace(data.workspace);
      setPhase("process");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.warn("API failed, using demo data:", msg);
      setError(`Backend unreachable (${msg}). Using demo data — chat will not work.`);
      setWorkspace(buildWorkspace(topic.trim() || "AI for scientific discovery", demoPapers));
      setPhase("process");
    } finally {
      setLoading(false);
    }
  }

  if (phase === "process" && workspace) {
    return <Process workspace={workspace} />;
  }

  return <Home onStart={start} loading={loading} error={error} />;
}
