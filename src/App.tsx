import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, type SimulationNodeDatum, type SimulationLinkDatum } from "d3-force";
import { zoom as d3Zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from "d3-zoom";
import { select } from "d3-selection";
import "d3-transition";
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

  const topEntities = entityNodes
    .sort((a, b) => (b.count || 0) - (a.count || 0))
    .slice(0, 20);

  const topPapers = paperNodes
    .filter(p => (paperEdgeCount.get(p.id) || 0) > 0)
    .sort((a, b) => (paperEdgeCount.get(b.id) || 0) - (paperEdgeCount.get(a.id) || 0))
    .slice(0, 8);

  const selectedNodes = [...topEntities, ...topPapers];
  const selectedIds = new Set(selectedNodes.map(n => n.id));

  const nodes: LayoutNode[] = selectedNodes.map(n => ({
    id: n.id,
    name: n.label,
    type: n.type,
    x: 0,
    y: 0,
    r: n.type === "paper" ? 3 : Math.min(13, 8 + (n.count || 0))
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
  height: number,
  existingPositions?: Map<string, { x: number; y: number }>
): { nodes: LayoutNode[]; edges: { source: string; target: string; label: string }[] } {
  if (inputNodes.length === 0) return { nodes: [], edges: [] };

  const simNodes: ForceNode[] = inputNodes.map(n => {
    const prev = existingPositions?.get(n.id);
    return {
      ...n,
      x: prev ? prev.x : width / 2 + (Math.random() - 0.5) * width * 0.6,
      y: prev ? prev.y : height / 2 + (Math.random() - 0.5) * height * 0.6
    };
  });

  const nodeById = new Map(simNodes.map(n => [n.id, n]));
  const simEdges: ForceEdge[] = inputEdges
    .filter(e => nodeById.has(e.source) && nodeById.has(e.target))
    .map(e => ({ source: e.source, target: e.target, label: e.label }));

  const sim = forceSimulation<ForceNode>(simNodes)
    .force("link", forceLink<ForceNode, ForceEdge>(simEdges).id(d => d.id).distance(220).strength(0.25))
    .force("charge", forceManyBody<ForceNode>().strength(-800))
    .force("center", forceCenter(width / 2, height / 2))
    .force("collide", forceCollide<ForceNode>().radius(d => d.r + 24))
    .stop();

  for (let i = 0; i < 300; i++) sim.tick();

  const pad = 40;
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
  loading: wsLoading,
  topic,
  onWorkspaceUpdate,
}: {
  workspace: Workspace | null;
  loading: boolean;
  topic: string;
  onWorkspaceUpdate: (ws: Workspace) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [citedPaperIds, setCitedPaperIds] = useState<Set<string>>(new Set());
  const [visibleCount, setVisibleCount] = useState(0);
  const [dragId, setDragId] = useState<string | null>(null);
  const [nodePositions, setNodePositions] = useState<Map<string, { x: number; y: number }>>(new Map());
  const [zoomTransform, setZoomTransform] = useState<ZoomTransform>(zoomIdentity);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const layoutPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const seenNodeIdsRef = useRef<Set<string>>(new Set());
  const prevNodeCountRef = useRef(0);

  const isEmpty = !workspace || (workspace.papers.length === 0 && workspace.entities.length === 0);

  const { nodes: rawNodes, edges: rawEdges } = useMemo(
    () => workspace ? selectGraphNodes(workspace) : { nodes: [], edges: [] },
    [workspace]
  );

  const { nodes: forceNodes, edges: graphEdges } = useMemo(
    () => {
      const result = runForceLayout(rawNodes, rawEdges, 1200, 660, layoutPositionsRef.current);
      const posMap = new Map<string, { x: number; y: number }>();
      for (const n of result.nodes) posMap.set(n.id, { x: n.x, y: n.y });
      layoutPositionsRef.current = posMap;
      return result;
    },
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
    const currentCount = graphNodes.length;
    const prevCount = prevNodeCountRef.current;
    if (currentCount === 0) {
      setVisibleCount(0);
      prevNodeCountRef.current = 0;
      return;
    }
    if (prevCount === 0) {
      setVisibleCount(0);
      setNodePositions(new Map());
      let count = 0;
      const interval = setInterval(() => {
        count += Math.max(1, Math.floor(currentCount / 20));
        if (count >= currentCount) {
          setVisibleCount(currentCount);
          clearInterval(interval);
        } else {
          setVisibleCount(count);
        }
      }, 60);
      prevNodeCountRef.current = currentCount;
      return () => clearInterval(interval);
    }
    if (currentCount > prevCount) {
      setVisibleCount(prevCount);
      let count = prevCount;
      const newCount = currentCount - prevCount;
      const interval = setInterval(() => {
        count += Math.max(1, Math.floor(newCount / 10));
        if (count >= currentCount) {
          setVisibleCount(currentCount);
          clearInterval(interval);
        } else {
          setVisibleCount(count);
        }
      }, 60);
      prevNodeCountRef.current = currentCount;
      return () => clearInterval(interval);
    }
    setVisibleCount(currentCount);
    prevNodeCountRef.current = currentCount;
  }, [forceNodes.length]);

  useEffect(() => {
    if (!workspace?.id || workspace.status !== "building") return;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/workspaces/${workspace.id}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.workspace) onWorkspaceUpdate(data.workspace);
      } catch {}
    }, 2000);
    return () => clearInterval(timer);
  }, [workspace?.id, workspace?.status, onWorkspaceUpdate]);

  const selected = graphNodes.find((n) => n.id === selectedId) ?? null;

  const citedNodeIds = useMemo(() => {
    if (citedPaperIds.size === 0) return new Set<string>();
    const ids = new Set<string>(citedPaperIds);
    for (const entity of workspace?.entities || []) {
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

    const assistantId = `a-${Date.now()}`;

    try {
      const streamRes = await fetch(`${API_BASE}/api/workspaces/${workspace.id}/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg })
      });

      if (!streamRes.ok || !streamRes.body) throw new Error("stream-unavailable");

      setChatMessages(prev => [...prev, { id: assistantId, role: "assistant", content: "" }]);
      setChatLoading(false);

      const reader = streamRes.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let pIds: string[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6);
          if (payload === "[DONE]") break;
          try {
            const parsed = JSON.parse(payload);
            if (parsed.token) {
              setChatMessages(prev =>
                prev.map(m => m.id === assistantId ? { ...m, content: m.content + parsed.token } : m)
              );
            }
            if (parsed.evidence) {
              pIds = [...new Set((parsed.evidence || []).map((e: { paperId: string }) => e.paperId).filter(Boolean))] as string[];
              setChatMessages(prev =>
                prev.map(m => m.id === assistantId ? { ...m, paperIds: pIds, evidenceIds: parsed.evidence.map((e: { id: string }) => e.id) } : m)
              );
              setCitedPaperIds(new Set(pIds));
            }
          } catch {}
        }
      }
    } catch {
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
          id: assistantId,
          role: "assistant",
          content: data.answer || "No response received.",
          evidenceIds: data.evidence?.map((e: { id: string }) => e.id),
          paperIds: pIds
        };
        setChatMessages(prev => {
          const without = prev.filter(m => m.id !== assistantId);
          return [...without, assistantMsg];
        });
        setCitedPaperIds(new Set(pIds));
      } catch (err) {
        setChatMessages(prev => {
          const without = prev.filter(m => m.id !== assistantId);
          return [...without, {
            id: assistantId,
            role: "assistant" as const,
            content: `Error: ${err instanceof Error ? err.message : "Failed to reach server"}. Make sure the backend is running.`
          }];
        });
      }
    } finally {
      setChatLoading(false);
    }
  }, [chatLoading, workspace?.id]);

  const suggestions = useMemo(() => [
    `What are the key findings in ${(workspace?.topic || topic).split(" ").slice(0, 4).join(" ")}?`,
    "What methods are most commonly used?",
    "Summarize the main research gaps",
    "What materials or datasets are studied?"
  ], [workspace, topic]);

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
    const x = (svgPt.x - zoomTransform.x) / zoomTransform.k;
    const y = (svgPt.y - zoomTransform.y) / zoomTransform.k;
    setNodePositions(prev => {
      const next = new Map(prev);
      next.set(dragId, { x, y });
      return next;
    });
  }, [dragId, zoomTransform]);

  const handlePointerUp = useCallback(() => {
    setDragId(null);
  }, []);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = svgRef.current;
    const zoomBehavior = d3Zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 4])
      .on("zoom", (event) => {
        setZoomTransform(event.transform);
      });
    zoomRef.current = zoomBehavior;
    select(svg).call(zoomBehavior);
    select(svg).on("dblclick.zoom", null);
    return () => { select(svg).on(".zoom", null); };
  }, []);

  const handleZoomIn = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return;
    select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 1.4);
  }, []);

  const handleZoomOut = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return;
    select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 0.7);
  }, []);

  const handleZoomReset = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return;
    select(svgRef.current).transition().duration(400).call(zoomRef.current.transform, zoomIdentity);
  }, []);

  return (
    <div className="process-page">
      <nav className="navbar">
        <div className="nav-brand">N.E.R.D</div>
        <div className="nav-center">
          <div className="step-badge">WORKSPACE</div>
          <div className="step-name">{(workspace?.topic || topic).length > 50 ? (workspace?.topic || topic).slice(0, 48) + "..." : (workspace?.topic || topic)}</div>
        </div>
        <div className="nav-status">
          {wsLoading && !workspace ? (
            <span className="status-text">Building workspace...</span>
          ) : workspace?.status === "building" ? (
            <>
              <span className="status-dot-round building" />
              <span className="status-text">
                {workspace.progress?.processed || 0}/{workspace.progress?.total || "?"} papers
              </span>
            </>
          ) : workspace ? (
            <>
              <span className="status-dot-round complete" />
              <span className="status-text">{workspace.papers.length} papers / {workspace.entities.length} entities</span>
            </>
          ) : null}
        </div>
      </nav>

      {wsLoading && !workspace ? (
        <div className="loading-skeleton">
          <div className="skeleton-graph">
            <svg viewBox="0 0 1200 660" className="skeleton-svg">
              <circle cx="420" cy="230" r="20" className="skeleton-pulse" />
              <circle cx="320" cy="160" r="12" className="skeleton-pulse s2" />
              <circle cx="520" cy="170" r="14" className="skeleton-pulse s3" />
              <circle cx="350" cy="310" r="10" className="skeleton-pulse s4" />
              <circle cx="500" cy="300" r="11" className="skeleton-pulse s5" />
              <circle cx="260" cy="240" r="8" className="skeleton-pulse s6" />
              <circle cx="580" cy="240" r="9" className="skeleton-pulse s7" />
              <line x1="420" y1="230" x2="320" y2="160" className="skeleton-line" />
              <line x1="420" y1="230" x2="520" y2="170" className="skeleton-line" />
              <line x1="420" y1="230" x2="350" y2="310" className="skeleton-line" />
              <line x1="420" y1="230" x2="500" y2="300" className="skeleton-line" />
              <line x1="320" y1="160" x2="260" y2="240" className="skeleton-line" />
              <line x1="520" y1="170" x2="580" y2="240" className="skeleton-line" />
            </svg>
            <div className="skeleton-text">Building knowledge graph...</div>
            <div className="skeleton-subtext">Searching papers, extracting entities, linking facts</div>
          </div>
        </div>
      ) : (
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
              viewBox="0 0 1200 660"
              ref={svgRef}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
            >
              <g transform={`translate(${zoomTransform.x},${zoomTransform.y}) scale(${zoomTransform.k})`}>
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
                    {node.type === "paper" ? (
                      <title>{node.name}</title>
                    ) : (
                      <text
                        x={node.r + 6}
                        y={4}
                        textAnchor="start"
                        className={isCited ? "cited-text" : ""}
                      >
                        {node.name.length > 24 ? `${node.name.slice(0, 22)}...` : node.name}
                      </text>
                    )}
                  </g>
                );
              })}
              </g>
            </svg>

            <div className="zoom-controls">
              <button className="zoom-btn" onClick={handleZoomIn} title="Zoom in">+</button>
              <button className="zoom-btn" onClick={handleZoomReset} title="Reset zoom">⟳</button>
              <button className="zoom-btn" onClick={handleZoomOut} title="Zoom out">−</button>
            </div>

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
            {workspace?.status === "building" && workspace.progress && (
              <div className="building-overlay">
                <div className="building-progress-bar">
                  <div
                    className="building-progress-fill"
                    style={{ width: `${workspace.progress.total ? (workspace.progress.processed / workspace.progress.total) * 100 : 0}%` }}
                  />
                </div>
                <span className="building-label">
                  {workspace.progress.processed}/{workspace.progress.total} papers
                </span>
              </div>
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
            <span className="chat-header-meta">{workspace?.id ? "LIVE" : "LOCAL"}</span>
          </div>

          {chatMessages.length === 0 && !chatLoading ? (
            <div className="chat-welcome">
              <div className="chat-welcome-icon">◇</div>
              <div className="chat-welcome-title">Ask your research expert</div>
              <div className="chat-welcome-desc">
                This workspace has {workspace?.papers.length || 0} papers and {workspace?.entities.length || 0} entities. Ask any question and get answers grounded in the literature.
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
      )}
    </div>
  );
}

export default function App() {
  const [phase, setPhase] = useState<Phase>("home");
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingTopic, setPendingTopic] = useState("");

  async function start(topic: string) {
    const t = topic.trim() || "AI for scientific discovery";
    setPendingTopic(t);
    setLoading(true);
    setError(null);
    setPhase("process");

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
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.warn("API failed, using demo data:", msg);
      setError(`Backend unreachable (${msg}). Using demo data — chat will not work.`);
      setWorkspace(buildWorkspace(topic.trim() || "AI for scientific discovery", demoPapers));
    } finally {
      setLoading(false);
    }
  }

  if (phase === "process") {
    return <Process workspace={workspace} loading={loading} topic={pendingTopic} onWorkspaceUpdate={setWorkspace} />;
  }

  return <Home onStart={start} loading={loading} error={error} />;
}
