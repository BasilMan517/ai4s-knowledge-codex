import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { forceSimulation, forceLink, forceManyBody, forceCollide, forceX, forceY, type SimulationNodeDatum, type SimulationLinkDatum } from "d3-force";
import { zoom as d3Zoom, zoomIdentity, zoomTransform, type ZoomBehavior } from "d3-zoom";
import { select } from "d3-selection";
import { drag } from "d3-drag";
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
  material: "#3498db",
  method: "#FF6B35",
  property: "#27ae60",
  task: "#9b59b6",
  dataset: "#f39c12",
  system: "#004E89",
  model: "#C5283D",
  topic: "#E9724C",
  paper: "#7B2D8E",
  concept: "#1A936F",
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
type ForceEdge = SimulationLinkDatum<ForceNode> & { label: string; curvature: number };

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

  const topEntityIds = new Set(topEntities.map(n => n.id));
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
    r: n.type === "paper" ? 6 : Math.min(16, 9 + (n.count || 0) * 1.5)
  }));

  const edges = allEdges
    .filter((e: GraphEdge) => selectedIds.has(e.source) && selectedIds.has(e.target))
    .map((e: GraphEdge) => ({ source: e.source, target: e.target, label: e.label }));

  return { nodes, edges };
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
              <span className="highlight-bold">N.E.R.D</span> searches papers
              from OpenAlex &amp; Semantic Scholar, extracts entities and structured facts, builds a knowledge graph,
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
                  <span className="model-badge">OpenAlex + Semantic Scholar + LLM</span>
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
                <div className="metric-value">2</div>
                <div className="metric-label">Sources</div>
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const simulationRef = useRef<ReturnType<typeof forceSimulation<ForceNode>> | null>(null);
  const layoutPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  const isEmpty = !workspace || (workspace.papers.length === 0 && workspace.entities.length === 0);

  const { nodes: rawNodes, edges: rawEdges } = useMemo(
    () => workspace ? selectGraphNodes(workspace) : { nodes: [], edges: [] },
    [workspace]
  );

  const selected = rawNodes.find(n => n.id === selectedId) ?? null;
  const selectedPaper = selected?.type === "paper" ? workspace?.papers.find(p => p.id === selected.id) : null;
  const selectedEntity = selected && selected.type !== "paper" ? workspace?.entities.find(e => e.id === selected.id) : null;

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

  const nodeMap = useMemo(() => {
    const m = new Map<string, LayoutNode>();
    for (const n of rawNodes) m.set(n.id, n);
    return m;
  }, [rawNodes]);

  // ─── WORKSPACE POLLING ───
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

  // ─── D3 IMPERATIVE GRAPH (MiroFish style) ───
  useEffect(() => {
    if (!svgRef.current) return;
    const svgEl = svgRef.current;
    const svg = select(svgEl);
    const width = 1200;
    const height = 660;

    // Save positions from previous simulation
    if (simulationRef.current) {
      simulationRef.current.stop();
      for (const n of simulationRef.current.nodes()) {
        if (n.x != null && n.y != null) {
          layoutPositionsRef.current.set(n.id, { x: n.x, y: n.y });
        }
      }
    }

    svg.selectAll("g.graph-content").remove();
    simulationRef.current = null;

    if (rawNodes.length === 0) return;

    // Set up zoom once
    if (!zoomRef.current) {
      const zoomBehavior = d3Zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.3, 4])
        .on("zoom", (event) => {
          svg.select("g.graph-content").attr("transform", event.transform);
        });
      zoomRef.current = zoomBehavior;
      svg.call(zoomBehavior);
      svg.on("dblclick.zoom", null);
      svg.on("click.deselect", () => setSelectedId(null));
    }

    const g = svg.append("g").attr("class", "graph-content");
    const currentTransform = zoomTransform(svgEl);
    g.attr("transform", currentTransform.toString());

    // Build simulation nodes with preserved positions
    const simNodes: ForceNode[] = rawNodes.map(n => {
      const prev = layoutPositionsRef.current.get(n.id);
      return {
        ...n,
        x: prev ? prev.x : width / 2 + (Math.random() - 0.5) * width * 0.5,
        y: prev ? prev.y : height / 2 + (Math.random() - 0.5) * height * 0.5,
      };
    });

    const nodeIdSet = new Set(simNodes.map(n => n.id));

    // Compute edge curvature for parallel edges
    const pairCount = new Map<string, number>();
    for (const e of rawEdges) {
      if (!nodeIdSet.has(e.source) || !nodeIdSet.has(e.target)) continue;
      const key = [e.source, e.target].sort().join("|");
      pairCount.set(key, (pairCount.get(key) || 0) + 1);
    }
    const pairIdx = new Map<string, number>();
    const simEdges: ForceEdge[] = rawEdges
      .filter(e => nodeIdSet.has(e.source) && nodeIdSet.has(e.target))
      .map(e => {
        const key = [e.source, e.target].sort().join("|");
        const total = pairCount.get(key) || 1;
        const idx = pairIdx.get(key) || 0;
        pairIdx.set(key, idx + 1);
        const curvature = total === 1 ? 0.15 : (idx - (total - 1) / 2) * 0.3;
        return { source: e.source, target: e.target, label: e.label, curvature };
      });

    // Force simulation — MiroFish parameters
    const simulation = forceSimulation<ForceNode>(simNodes)
      .force("link", forceLink<ForceNode, ForceEdge>(simEdges).id(d => d.id).distance(200).strength(0.2))
      .force("charge", forceManyBody<ForceNode>().strength(-800))
      .force("collide", forceCollide<ForceNode>().radius(d => d.r + 35))
      .force("x", forceX<ForceNode>(width / 2).strength(0.035))
      .force("y", forceY<ForceNode>(height / 2).strength(0.035));

    simulationRef.current = simulation;

    // ─── EDGES (curved paths) ───
    const linkGroup = g.append("g").attr("class", "links");
    const link = linkGroup.selectAll<SVGPathElement, ForceEdge>("path")
      .data(simEdges)
      .enter()
      .append("path")
      .attr("class", "graph-edge")
      .attr("fill", "none")
      .attr("stroke", "rgba(255, 255, 255, 0.25)")
      .attr("stroke-width", 1.5);

    // ─── EDGE LABELS with backgrounds ───
    const edgeLabelGroup = g.append("g").attr("class", "edge-labels");
    const labeledEdges = simEdges.filter(e => e.label);
    const edgeLabelG = edgeLabelGroup.selectAll<SVGGElement, ForceEdge>("g")
      .data(labeledEdges)
      .enter()
      .append("g")
      .attr("class", "edge-label-g")
      .style("pointer-events", "none");

    edgeLabelG.append("rect")
      .attr("fill", "rgba(22, 22, 26, 0.9)")
      .attr("rx", 3)
      .attr("ry", 3);

    edgeLabelG.append("text")
      .text(d => d.label.length > 20 ? d.label.slice(0, 18) + "..." : d.label)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("fill", "#8a8a96")
      .attr("font-size", "8px")
      .attr("font-family", "'JetBrains Mono', monospace");

    // Size background rects to fit text
    edgeLabelG.each(function () {
      const textEl = select(this).select("text").node() as SVGTextElement;
      if (!textEl) return;
      const bbox = textEl.getBBox();
      select(this).select("rect")
        .attr("x", -bbox.width / 2 - 4)
        .attr("y", -bbox.height / 2 - 2)
        .attr("width", bbox.width + 8)
        .attr("height", bbox.height + 4);
    });

    // ─── NODES ───
    const nodeGroup = g.append("g").attr("class", "nodes");
    const node = nodeGroup.selectAll<SVGGElement, ForceNode>("g")
      .data(simNodes)
      .enter()
      .append("g")
      .attr("class", "graph-node")
      .style("cursor", "pointer")
      .style("opacity", 0);

    // Fade in
    node.transition()
      .duration(400)
      .delay((_d, i) => i * 25)
      .style("opacity", 1);

    // Outer glow
    node.append("circle")
      .attr("class", "node-glow")
      .attr("r", d => d.r * 1.8)
      .attr("fill", d => colors[d.type] || "#888")
      .attr("opacity", 0.08);

    // Main circle
    node.append("circle")
      .attr("class", "node-main")
      .attr("r", d => d.r)
      .attr("fill", d => colors[d.type] || "#888")
      .attr("stroke", "rgba(22, 22, 26, 0.8)")
      .attr("stroke-width", 2);

    // Center dot
    node.filter(d => d.r > 8)
      .append("circle")
      .attr("r", 2)
      .attr("fill", "white")
      .attr("opacity", 0.5);

    // Text labels (non-paper)
    node.filter(d => d.type !== "paper")
      .append("text")
      .text(d => d.name.length > 24 ? d.name.slice(0, 22) + "..." : d.name)
      .attr("x", d => d.r + 6)
      .attr("y", 4)
      .attr("fill", "#8a8a96")
      .attr("font-size", "10px")
      .attr("font-weight", "500")
      .attr("font-family", "'JetBrains Mono', monospace")
      .style("pointer-events", "none");

    // Paper tooltips
    node.filter(d => d.type === "paper")
      .append("title")
      .text(d => d.name);

    // Click to select/deselect
    node.on("click", function (event, d) {
      event.stopPropagation();
      setSelectedId(prev => prev === d.id ? null : d.id);
    });

    // D3 drag with simulation reheat (MiroFish style)
    node.call(
      drag<SVGGElement, ForceNode>()
        .on("start", function (event, d) {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
          select(this).style("cursor", "grabbing");
        })
        .on("drag", function (event, d) {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on("end", function (event, d) {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
          select(this).style("cursor", "pointer");
        })
    );

    // Live tick handler — continuous position updates (MiroFish style)
    simulation.on("tick", () => {
      link.attr("d", d => {
        const s = d.source as unknown as ForceNode;
        const t = d.target as unknown as ForceNode;
        if (s.x == null || s.y == null || t.x == null || t.y == null) return "";
        if (s.id === t.id) {
          return `M${s.x},${s.y} C${s.x - 40},${s.y - 60} ${s.x + 40},${s.y - 60} ${s.x},${s.y}`;
        }
        const dx = t.x - s.x;
        const dy = t.y - s.y;
        const cx = (s.x + t.x) / 2 + dy * d.curvature;
        const cy = (s.y + t.y) / 2 - dx * d.curvature;
        return `M${s.x},${s.y} Q${cx},${cy} ${t.x},${t.y}`;
      });

      edgeLabelG.attr("transform", d => {
        const s = d.source as unknown as ForceNode;
        const t = d.target as unknown as ForceNode;
        if (s.x == null || s.y == null || t.x == null || t.y == null) return "";
        return `translate(${(s.x + t.x) / 2},${(s.y + t.y) / 2})`;
      });

      node.attr("transform", d => `translate(${d.x},${d.y})`);
    });

    return () => {
      simulation.stop();
      for (const n of simNodes) {
        if (n.x != null && n.y != null) {
          layoutPositionsRef.current.set(n.id, { x: n.x, y: n.y });
        }
      }
    };
  }, [rawNodes, rawEdges]);

  // ─── HIGHLIGHT EFFECT ───
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = select(svgRef.current);

    svg.selectAll<SVGGElement, ForceNode>("g.graph-node")
      .classed("selected", d => d.id === selectedId)
      .classed("cited", d => citedNodeIds.has(d.id))
      .classed("dimmed", d => citedNodeIds.size > 0 && !citedNodeIds.has(d.id) && d.id !== selectedId);

    svg.selectAll<SVGGElement, ForceNode>("g.graph-node").each(function (d) {
      const mainCircle = select(this).select(".node-main");
      if (d.id === selectedId) {
        mainCircle.attr("stroke", "#ff4500").attr("stroke-width", 3);
      } else {
        mainCircle.attr("stroke", "rgba(22, 22, 26, 0.8)").attr("stroke-width", 2);
      }
    });

    svg.selectAll<SVGPathElement, ForceEdge>("path.graph-edge").each(function (d) {
      const s = d.source as unknown as ForceNode;
      const t = d.target as unknown as ForceNode;
      const isHighlighted = (selectedId && (s.id === selectedId || t.id === selectedId))
        || (citedNodeIds.size > 0 && citedNodeIds.has(s.id) && citedNodeIds.has(t.id));
      const isDimmed = citedNodeIds.size > 0 && !isHighlighted;
      select(this)
        .attr("stroke", isHighlighted ? "#6da6d4" : isDimmed ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.25)")
        .attr("stroke-width", isHighlighted ? 2.5 : 1.5);
    });

    svg.selectAll<SVGGElement, ForceEdge>("g.edge-label-g")
      .style("opacity", d => {
        const s = d.source as unknown as ForceNode;
        const t = d.target as unknown as ForceNode;
        if (!selectedId) return 1;
        return (s.id === selectedId || t.id === selectedId) ? 1 : 0.3;
      });
  }, [selectedId, citedNodeIds]);

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
                <span className="stat-item">{rawNodes.length} nodes</span>
                <span className="stat-divider">|</span>
                <span className="stat-item">{rawEdges.length} edges</span>
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
                />

                <div className="zoom-controls">
                  <button className="zoom-btn" onClick={handleZoomIn} title="Zoom in">+</button>
                  <button className="zoom-btn" onClick={handleZoomReset} title="Reset zoom">⟳</button>
                  <button className="zoom-btn" onClick={handleZoomOut} title="Zoom out">−</button>
                </div>

                {selected && (
                  <div className="detail-panel">
                    <div className="detail-panel-header">
                      <span className="detail-title">{selected.type === "paper" ? "Paper" : "Entity"}</span>
                      <span className="detail-badge" style={{ background: colors[selected.type] || "#888" }}>
                        {selected.type}
                      </span>
                      <button className="detail-close" onClick={() => setSelectedId(null)}>✕</button>
                    </div>
                    <div className="detail-content">
                      {selectedPaper ? (
                        <>
                          <h3 className="detail-paper-title">{selectedPaper.title}</h3>
                          {selectedPaper.authors && (
                            <p className="detail-authors">{selectedPaper.authors}</p>
                          )}
                          <div className="detail-meta-row">
                            {selectedPaper.year && <span className="detail-meta-tag">{selectedPaper.year}</span>}
                            {selectedPaper.venue && <span className="detail-meta-tag">{selectedPaper.venue}</span>}
                            {selectedPaper.citationCount != null && <span className="detail-meta-tag">🔗 {selectedPaper.citationCount} citations</span>}
                            {selectedPaper.source && <span className="detail-meta-tag">{selectedPaper.source}</span>}
                          </div>
                          {selectedPaper.abstract && (
                            <p className="detail-abstract">{selectedPaper.abstract.length > 400 ? selectedPaper.abstract.slice(0, 400) + "..." : selectedPaper.abstract}</p>
                          )}
                          {selectedPaper.labels.length > 0 && (
                            <div className="detail-labels">
                              {selectedPaper.labels.slice(0, 6).map(l => (
                                <span key={l} className="detail-label-tag">{l}</span>
                              ))}
                            </div>
                          )}
                          {selectedPaper.url && (
                            <a className="detail-link" href={selectedPaper.url} target="_blank" rel="noopener noreferrer">
                              Open paper ↗
                            </a>
                          )}
                        </>
                      ) : selectedEntity ? (
                        <>
                          <h3 className="detail-paper-title">{selectedEntity.name}</h3>
                          <div className="detail-meta-row">
                            <span className="detail-meta-tag">{selectedEntity.type}</span>
                            <span className="detail-meta-tag">{selectedEntity.paperIds.length} papers</span>
                          </div>
                          <div className="detail-section">
                            <span className="detail-label">Related papers:</span>
                            <ul className="detail-paper-list">
                              {selectedEntity.paperIds.slice(0, 5).map(pid => {
                                const p = workspace?.papers.find(pp => pp.id === pid);
                                return p ? (
                                  <li key={pid} className="detail-paper-item" onClick={() => setSelectedId(pid)}>
                                    {p.title} {p.year ? `(${p.year})` : ""}
                                  </li>
                                ) : null;
                              })}
                            </ul>
                          </div>
                        </>
                      ) : (
                        <div className="detail-row">
                          <span className="detail-label">Name:</span>
                          <span className="detail-value highlight">{selected.name}</span>
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
