import type { Cluster, Entity, EvidenceChunk, Fact, Paper, Workspace } from "../types";

const METHOD_TERMS = [
  "rag",
  "retrieval",
  "llm",
  "agent",
  "bayesian",
  "active learning",
  "graph neural network",
  "gnn",
  "molecular dynamics",
  "dft",
  "machine learning",
  "database",
  "text mining",
  "simulation",
  "sql",
  "optimization",
  "generation"
];

const PROPERTY_TERMS = [
  "ionic conductivity",
  "conductivity",
  "capacity",
  "cycle",
  "state of health",
  "soh",
  "remaining useful life",
  "rul",
  "stability",
  "energy density"
];

const MATERIAL_TERMS = [
  "solid electrolyte",
  "electrolyte",
  "lithium metal",
  "lithium-ion",
  "cathode",
  "anode",
  "mof",
  "crystal",
  "battery",
  "materials"
];

export function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, " ").trim();
}

export function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

function paperText(paper: Paper): string {
  return [paper.title, paper.authors, paper.venue, paper.year, paper.labels.join(" "), paper.abstract]
    .filter(Boolean)
    .join(" ");
}

function termMatches(text: string, terms: string[]): string[] {
  const normalized = normalizeText(text);
  return terms.filter((term) => normalized.includes(normalizeText(term)));
}

export function scorePaper(paper: Paper, query: string): number {
  const tokens = tokenize(query);
  if (!tokens.length) return paper.relevanceScore ?? 0;

  const title = normalizeText(paper.title);
  const labels = normalizeText(paper.labels.join(" "));
  const body = normalizeText(paperText(paper));
  let score = 0;

  for (const token of tokens) {
    if (title.includes(token)) score += 5;
    if (labels.includes(token)) score += 4;
    if (body.includes(token)) score += 1;
  }

  if (normalizeText(query).length > 4 && body.includes(normalizeText(query))) {
    score += 8;
  }

  return score + (paper.relevanceScore ?? 0) * 0.05;
}

export function searchPapers(papers: Paper[], query: string, limit = 20): Paper[] {
  return [...papers]
    .map((paper) => ({ paper, score: scorePaper(paper, query) }))
    .filter(({ score }) => score > 0 || !query.trim())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ paper }) => paper);
}

export function buildEvidence(papers: Paper[], query: string, limit = 12): EvidenceChunk[] {
  const queryTokens = tokenize(query);

  return papers
    .flatMap((paper) => {
      const chunks: EvidenceChunk[] = [
        {
          id: `${paper.id}-title`,
          paperId: paper.id,
          paperTitle: paper.title,
          text: paper.title,
          kind: "title",
          score: 0,
          citation: makeCitation(paper)
        },
        {
          id: `${paper.id}-abstract`,
          paperId: paper.id,
          paperTitle: paper.title,
          text: paper.abstract,
          kind: "abstract",
          score: 0,
          citation: makeCitation(paper)
        }
      ];

      return chunks.map((chunk) => {
        const chunkText = normalizeText(chunk.text);
        const score =
          queryTokens.reduce((total, token) => total + (chunkText.includes(token) ? 1 : 0), 0) +
          scorePaper(paper, query) * 0.15;

        return { ...chunk, score };
      });
    })
    .filter((chunk) => chunk.score > 0 || !query.trim())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function makeCitation(paper: Paper): string {
  const year = paper.year ? `, ${paper.year}` : "";
  const venue = paper.venue ? `${paper.venue}${year}` : year.replace(/^, /, "");
  const doi = paper.doi ? `, DOI ${paper.doi}` : "";
  return `${paper.title}${venue ? ` (${venue})` : ""}${doi}`;
}

export function deriveEntities(papers: Paper[]): Entity[] {
  const map = new Map<string, Entity>();

  function add(name: string, type: Entity["type"], paperId: string) {
    const key = `${type}:${normalizeText(name)}`;
    const current =
      map.get(key) ??
      ({
        id: key.replace(/[^a-z0-9]+/g, "-"),
        name,
        type,
        paperIds: []
      } satisfies Entity);

    if (!current.paperIds.includes(paperId)) current.paperIds.push(paperId);
    map.set(key, current);
  }

  for (const paper of papers) {
    const text = paperText(paper);
    for (const term of termMatches(text, METHOD_TERMS)) add(term, "method", paper.id);
    for (const term of termMatches(text, PROPERTY_TERMS)) add(term, "property", paper.id);
    for (const term of termMatches(text, MATERIAL_TERMS)) add(term, "material", paper.id);
    for (const label of paper.labels) add(label, classifyLabel(label), paper.id);
  }

  return [...map.values()].sort((a, b) => b.paperIds.length - a.paperIds.length);
}

function classifyLabel(label: string): Entity["type"] {
  const normalized = normalizeText(label);
  if (METHOD_TERMS.some((term) => normalized.includes(normalizeText(term)))) return "method";
  if (PROPERTY_TERMS.some((term) => normalized.includes(normalizeText(term)))) return "property";
  if (MATERIAL_TERMS.some((term) => normalized.includes(normalizeText(term)))) return "material";
  if (normalized.includes("database") || normalized.includes("dataset")) return "dataset";
  if (normalized.includes("agent") || normalized.includes("assistant")) return "system";
  return "task";
}

export function deriveFacts(papers: Paper[]): Fact[] {
  const facts: Fact[] = [];

  for (const paper of papers) {
    const text = paperText(paper);
    const methods = termMatches(text, METHOD_TERMS);
    const properties = termMatches(text, PROPERTY_TERMS);
    const materials = termMatches(text, MATERIAL_TERMS);

    for (const method of methods.slice(0, 4)) {
      facts.push({
        id: `${paper.id}-method-${method.replace(/\s+/g, "-")}`,
        paperId: paper.id,
        paperTitle: paper.title,
        subject: paper.title,
        predicate: "uses_method",
        object: method,
        evidence: paper.abstract,
        confidence: 0.78
      });
    }

    for (const property of properties.slice(0, 3)) {
      facts.push({
        id: `${paper.id}-property-${property.replace(/\s+/g, "-")}`,
        paperId: paper.id,
        paperTitle: paper.title,
        subject: paper.title,
        predicate: "targets_property",
        object: property,
        evidence: paper.abstract,
        confidence: 0.7
      });
    }

    for (const material of materials.slice(0, 3)) {
      facts.push({
        id: `${paper.id}-material-${material.replace(/\s+/g, "-")}`,
        paperId: paper.id,
        paperTitle: paper.title,
        subject: paper.title,
        predicate: "studies_material_system",
        object: material,
        evidence: paper.abstract,
        confidence: 0.72
      });
    }
  }

  return facts;
}

export function deriveClusters(papers: Paper[]): Cluster[] {
  const clusterTerms: Array<Omit<Cluster, "paperIds">> = [
    {
      id: "cluster-agentic-systems",
      label: "Agentic research systems",
      terms: ["agent", "assistant", "llm", "codex", "tool", "rag", "retrieval"]
    },
    {
      id: "cluster-structured-kb",
      label: "Structured knowledge bases",
      terms: ["database", "text mining", "entity extraction", "sql", "knowledge"]
    },
    {
      id: "cluster-material-discovery",
      label: "Materials discovery loops",
      terms: ["discovery", "screening", "bayesian", "active learning", "optimization", "generation"]
    },
    {
      id: "cluster-electrolytes",
      label: "Electrolytes and ionic transport",
      terms: ["electrolyte", "ionic conductivity", "conductivity", "molecular dynamics"]
    },
    {
      id: "cluster-battery-health",
      label: "Battery health and forecasting",
      terms: ["state of health", "soh", "remaining useful life", "rul", "degradation"]
    }
  ];

  return clusterTerms
    .map((cluster) => ({
      ...cluster,
      paperIds: papers
        .filter((paper) => {
          const text = normalizeText(paperText(paper));
          return cluster.terms.some((term) => text.includes(normalizeText(term)));
        })
        .map((paper) => paper.id)
    }))
    .filter((cluster) => cluster.paperIds.length > 0);
}

export function buildWorkspace(topic: string, papers: Paper[]): Workspace {
  const filteredPapers = searchPapers(papers, topic, Math.max(papers.length, 1));
  const scopedPapers = filteredPapers.length ? filteredPapers : papers;
  return {
    topic,
    papers: scopedPapers,
    facts: deriveFacts(scopedPapers),
    entities: deriveEntities(scopedPapers),
    clusters: deriveClusters(scopedPapers)
  };
}

export function answerFromEvidence(question: string, evidence: EvidenceChunk[]): string {
  if (!evidence.length) {
    return "当前知识库没有找到足够证据。建议先导入更多论文、摘要或 PDF，再重新检索。";
  }

  const topPapers = [...new Map(evidence.map((item) => [item.paperId, item])).values()].slice(0, 4);
  const bullets = topPapers
    .map((item, index) => {
      const trimmed = item.text.length > 240 ? `${item.text.slice(0, 240)}...` : item.text;
      return `${index + 1}. ${trimmed}\n   Citation: ${item.citation}`;
    })
    .join("\n\n");

  return `基于当前知识库，问题「${question}」可以先从这些证据展开：\n\n${bullets}\n\n可继续让 Codex 用这些 evidence IDs 生成综述、对比表、CSV 或分析代码。`;
}

export function makeCodexContext(workspace: Workspace, question: string, evidence: EvidenceChunk[]): string {
  const papers = workspace.papers
    .slice(0, 20)
    .map((paper) => `- ${paper.id}: ${makeCitation(paper)}\n  Labels: ${paper.labels.join(", ")}\n  Abstract: ${paper.abstract}`)
    .join("\n");

  const facts = workspace.facts
    .slice(0, 40)
    .map((fact) => `- ${fact.subject} | ${fact.predicate} | ${fact.object} | confidence=${fact.confidence}`)
    .join("\n");

  const snippets = evidence.map((item) => `- ${item.id}: ${item.text}\n  Citation: ${item.citation}`).join("\n");

  return `# AI4S Knowledge Codex Context

Topic: ${workspace.topic}
Question: ${question}

## Papers
${papers}

## Structured Facts
${facts}

## Retrieved Evidence
${snippets}

## Grounding Rules
- Cite paper IDs or citations for scientific claims.
- Separate evidence from inference.
- State when the corpus is incomplete.
- Prefer structured facts for tables and numeric comparisons.
`;
}
