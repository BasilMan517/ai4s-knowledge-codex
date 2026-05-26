const METHOD_TERMS = [
  "retrieval augmented generation",
  "rag",
  "large language model",
  "llm",
  "agent",
  "bayesian optimization",
  "active learning",
  "graph neural network",
  "gnn",
  "machine learning",
  "deep learning",
  "molecular dynamics",
  "density functional theory",
  "dft",
  "knowledge graph",
  "database",
  "text mining",
  "simulation",
  "optimization",
  "foundation model",
  "generative"
];

const PROPERTY_TERMS = [
  "ionic conductivity",
  "conductivity",
  "capacity",
  "cycle life",
  "state of health",
  "soh",
  "remaining useful life",
  "rul",
  "stability",
  "voltage",
  "energy density"
];

const MATERIAL_TERMS = [
  "solid electrolyte",
  "electrolyte",
  "lithium metal",
  "lithium ion",
  "lithium-ion",
  "cathode",
  "anode",
  "battery",
  "polymer",
  "oxide",
  "sulfide",
  "nasicon",
  "garnet",
  "mof",
  "crystal"
];

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, " ")
    .trim();
}

function expandQuery(query) {
  const normalized = normalize(query);
  const expansions = [];
  const dictionary = [
    [["材料", "体系", "材料体系"], ["material", "materials", "material system", "electrolyte", "cathode", "anode"]],
    [["方法", "路线", "技术"], ["method", "machine learning", "deep learning", "simulation", "optimization"]],
    [["数据", "缺口", "不足"], ["data", "dataset", "database", "missing", "gap"]],
    [["图谱", "知识图谱"], ["knowledge graph", "entity", "fact"]],
    [["论文", "文献"], ["paper", "abstract", "citation"]],
    [["电解质"], ["electrolyte", "solid electrolyte", "ionic conductivity"]],
    [["电导率", "离子电导率"], ["ionic conductivity", "conductivity"]],
    [["智能体", "代理"], ["agent", "assistant", "tool"]],
    [["大模型"], ["large language model", "llm"]],
    [["贝叶斯"], ["bayesian optimization", "active learning"]]
  ];

  for (const [needles, terms] of dictionary) {
    if (needles.some((needle) => normalized.includes(normalize(needle)))) {
      expansions.push(...terms);
    }
  }

  return [query, ...expansions].join(" ");
}

function paperText(paper) {
  return [paper.title, paper.authors, paper.venue, paper.year, (paper.labels || []).join(" "), paper.abstract]
    .filter(Boolean)
    .join(" ");
}

function matches(text, terms) {
  const normalized = normalize(text);
  return terms.filter((term) => {
    const normalizedTerm = normalize(term);
    if (normalizedTerm.length <= 3) {
      return new RegExp(`(^|\\s)${normalizedTerm}(\\s|$)`).test(normalized);
    }
    return normalized.includes(normalizedTerm);
  });
}

function makeCitation(paper) {
  const year = paper.year ? `, ${paper.year}` : "";
  const venue = paper.venue ? `${paper.venue}${year}` : year.replace(/^, /, "");
  const doi = paper.doi ? `, DOI ${paper.doi}` : "";
  return `${paper.title}${venue ? ` (${venue})` : ""}${doi}`;
}

function chunkPapers(papers) {
  return papers.flatMap((paper) => [
    {
      id: `${paper.id}-title`,
      paperId: paper.id,
      kind: "title",
      text: paper.title,
      citation: makeCitation(paper)
    },
    {
      id: `${paper.id}-abstract`,
      paperId: paper.id,
      kind: "abstract",
      text: paper.abstract || [paper.title, ...(paper.labels || [])].join(". "),
      citation: makeCitation(paper)
    }
  ]);
}

function addEntity(map, name, type, paperId) {
  const key = `${type}:${normalize(name)}`;
  const current = map.get(key) || {
    id: key.replace(/[^a-z0-9]+/g, "-"),
    name,
    type,
    paperIds: []
  };
  if (!current.paperIds.includes(paperId)) current.paperIds.push(paperId);
  map.set(key, current);
}

function deriveEntities(papers) {
  const map = new Map();
  for (const paper of papers) {
    const text = paperText(paper);
    for (const term of matches(text, METHOD_TERMS)) addEntity(map, term, "method", paper.id);
    for (const term of matches(text, PROPERTY_TERMS)) addEntity(map, term, "property", paper.id);
    for (const term of matches(text, MATERIAL_TERMS)) addEntity(map, term, "material", paper.id);
    for (const label of paper.labels || []) addEntity(map, label, "concept", paper.id);
  }
  return [...map.values()].sort((a, b) => b.paperIds.length - a.paperIds.length);
}

function deriveFacts(papers) {
  const facts = [];
  for (const paper of papers) {
    const text = paperText(paper);
    for (const method of matches(text, METHOD_TERMS).slice(0, 5)) {
      facts.push({
        id: `${paper.id}-uses-${normalize(method).replace(/\s+/g, "-")}`,
        paperId: paper.id,
        subject: paper.title,
        predicate: "uses_method",
        object: method,
        evidence: paper.abstract || paper.title,
        confidence: 0.72
      });
    }
    for (const property of matches(text, PROPERTY_TERMS).slice(0, 4)) {
      facts.push({
        id: `${paper.id}-targets-${normalize(property).replace(/\s+/g, "-")}`,
        paperId: paper.id,
        subject: paper.title,
        predicate: "targets_property",
        object: property,
        evidence: paper.abstract || paper.title,
        confidence: 0.68
      });
    }
    for (const material of matches(text, MATERIAL_TERMS).slice(0, 4)) {
      facts.push({
        id: `${paper.id}-studies-${normalize(material).replace(/\s+/g, "-")}`,
        paperId: paper.id,
        subject: paper.title,
        predicate: "studies_material_system",
        object: material,
        evidence: paper.abstract || paper.title,
        confidence: 0.7
      });
    }
  }
  return [...new Map(facts.map((fact) => [fact.id, fact])).values()];
}

function buildGraph(papers, entities, facts) {
  const nodes = [
    ...papers.map((paper) => ({
      id: paper.id,
      label: paper.title,
      type: "paper",
      year: paper.year,
      venue: paper.venue
    })),
    ...entities.map((entity) => ({
      id: entity.id,
      label: entity.name,
      type: entity.type,
      count: entity.paperIds.length
    }))
  ];

  const entityByName = new Map(entities.map((entity) => [`${entity.type}:${normalize(entity.name)}`, entity]));
  const edgeMap = new Map();

  for (const fact of facts) {
    const type =
      fact.predicate === "uses_method"
        ? "method"
        : fact.predicate === "targets_property"
          ? "property"
          : "material";
    const entity = entityByName.get(`${type}:${normalize(fact.object)}`);
    if (!entity) continue;
    const edge = {
      id: `${fact.paperId}-${fact.predicate}-${entity.id}`,
      source: fact.paperId,
      target: entity.id,
      label: fact.predicate,
      confidence: fact.confidence
    };
    edgeMap.set(edge.id, edge);
  }

  return { nodes, edges: [...edgeMap.values()] };
}

function clusterPapers(papers) {
  const clusters = [
    {
      id: "agentic-systems",
      label: "Agentic research systems",
      terms: ["agent", "assistant", "llm", "large language model", "rag", "retrieval"]
    },
    {
      id: "knowledge-graph",
      label: "Knowledge graphs and databases",
      terms: ["database", "knowledge graph", "text mining", "entity", "structured"]
    },
    {
      id: "materials-discovery",
      label: "Materials discovery and optimization",
      terms: ["discovery", "screening", "bayesian", "active learning", "optimization", "generative"]
    },
    {
      id: "properties",
      label: "Properties and simulation",
      terms: ["conductivity", "capacity", "stability", "molecular dynamics", "dft", "simulation"]
    }
  ];

  return clusters
    .map((cluster) => ({
      ...cluster,
      paperIds: papers.filter((paper) => matches(paperText(paper), cluster.terms).length > 0).map((paper) => paper.id)
    }))
    .filter((cluster) => cluster.paperIds.length);
}

export function scoreChunk(chunk, query) {
  const tokens = normalize(expandQuery(query)).split(/\s+/).filter((token) => token.length > 1);
  const text = normalize(chunk.text);
  return tokens.reduce((score, token) => {
    const hit =
      token.length <= 3
        ? new RegExp(`(^|\\s)${token}(\\s|$)`).test(text)
        : text.includes(token);
    return score + (hit ? 1 : 0);
  }, 0);
}

export function retrieve(workspace, query, limit = 12) {
  return [...workspace.chunks]
    .map((chunk) => ({ ...chunk, score: scoreChunk(chunk, query) }))
    .filter((chunk) => chunk.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function buildKnowledgeBase(topic, papers) {
  const now = new Date().toISOString();
  const entities = deriveEntities(papers);
  const facts = deriveFacts(papers);
  const graph = buildGraph(papers, entities, facts);

  return {
    id: `ws-${Date.now().toString(36)}`,
    topic,
    status: "ready",
    papers,
    chunks: chunkPapers(papers),
    entities,
    facts,
    graph,
    clusters: clusterPapers(papers),
    createdAt: now,
    updatedAt: now
  };
}

export function createEmptyWorkspace(topic, totalPapers = 0) {
  const now = new Date().toISOString();
  return {
    id: `ws-${Date.now().toString(36)}`,
    topic,
    status: "building",
    progress: { total: totalPapers, processed: 0, phase: "fetching" },
    papers: [],
    chunks: [],
    entities: [],
    facts: [],
    graph: { nodes: [], edges: [] },
    clusters: [],
    createdAt: now,
    updatedAt: now
  };
}

export function addPaperBatch(workspace, newPapers) {
  workspace.papers.push(...newPapers);
  workspace.chunks = chunkPapers(workspace.papers);
  workspace.entities = deriveEntities(workspace.papers);
  workspace.facts = deriveFacts(workspace.papers);
  workspace.graph = buildGraph(workspace.papers, workspace.entities, workspace.facts);
  workspace.clusters = clusterPapers(workspace.papers);
  workspace.progress.processed = workspace.papers.length;
  workspace.updatedAt = new Date().toISOString();
  return workspace;
}

export function summarizeWorkspace(workspace) {
  return [
    `Topic: ${workspace.topic}`,
    `Papers: ${workspace.papers.length}`,
    `Entities: ${workspace.entities.length}`,
    `Facts: ${workspace.facts.length}`,
    `Clusters: ${workspace.clusters.map((cluster) => `${cluster.label} (${cluster.paperIds.length})`).join(", ")}`
  ].join("\n");
}

export function contextForModel(workspace, evidence = []) {
  const paperLines = workspace.papers
    .slice(0, 12)
    .map(
      (paper) =>
        `- ${paper.id}: ${makeCitation(paper)}\n  Labels: ${(paper.labels || []).slice(0, 5).join(", ")}\n  Abstract: ${(paper.abstract || "").slice(0, 300)}`
    )
    .join("\n");

  const factLines = workspace.facts
    .slice(0, 30)
    .map((fact) => `- ${fact.subject} | ${fact.predicate} | ${fact.object}`)
    .join("\n");

  const evidenceLines = evidence
    .slice(0, 8)
    .map((item) => `- ${item.id}: ${item.text}\n  Citation: ${item.citation}`)
    .join("\n");

  return `# Workspace Summary
${summarizeWorkspace(workspace)}

# Papers
${paperLines}

# Structured Facts
${factLines}

# Retrieved Evidence
${evidenceLines}`;
}

export function makeFallbackAnswer(workspace, question, evidence) {
  const snippets = evidence
    .slice(0, 6)
    .map((item, index) => `${index + 1}. ${item.text.slice(0, 260)}\n   Source: ${item.citation}`)
    .join("\n\n");

  return `当前没有配置 OPENAI_API_KEY，所以使用本地知识库检索生成简版回答。

问题：${question}

可以先参考以下证据：

${snippets || "没有检索到强相关证据。建议换一个更具体的 topic 或扩大论文数量。"}

工作区概况：
${summarizeWorkspace(workspace)}`;
}

export function graphToMermaid(workspace) {
  const topEdges = workspace.graph.edges.slice(0, 80);
  const label = (value) => String(value || "").replace(/"/g, "'").slice(0, 80);
  const nodeMap = new Map(workspace.graph.nodes.map((node) => [node.id, node]));
  const lines = ["flowchart LR"];

  for (const edge of topEdges) {
    const source = nodeMap.get(edge.source);
    const target = nodeMap.get(edge.target);
    if (!source || !target) continue;
    lines.push(`  "${edge.source}"["${label(source.label)}"] -->|"${edge.label}"| "${edge.target}"["${label(target.label)}"]`);
  }

  return lines.join("\n");
}
