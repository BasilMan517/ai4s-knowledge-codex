export type Paper = {
  id: string;
  openalexId?: string;
  title: string;
  authors: string;
  doi?: string;
  venue?: string;
  year?: number;
  publishedDate?: string;
  labels: string[];
  url?: string;
  abstract: string;
  citationCount?: number;
  relevanceScore?: number;
  source?: string;
};

export type EvidenceChunk = {
  id: string;
  paperId: string;
  paperTitle: string;
  text: string;
  kind: "title" | "abstract" | "note" | "derived";
  score?: number;
  citation: string;
};

export type Entity = {
  id: string;
  name: string;
  type:
    | "material"
    | "method"
    | "property"
    | "task"
    | "dataset"
    | "system"
    | "model";
  paperIds: string[];
};

export type Fact = {
  id: string;
  paperId: string;
  paperTitle?: string;
  subject: string;
  predicate: string;
  object: string;
  evidence: string;
  confidence: number;
};

export type Cluster = {
  id: string;
  label: string;
  paperIds: string[];
  terms: string[];
};

export type Workspace = {
  id?: string;
  topic: string;
  status?: string;
  papers: Paper[];
  chunks?: EvidenceChunk[];
  facts: Fact[];
  entities: Entity[];
  clusters: Cluster[];
  graph?: KnowledgeGraph;
  createdAt?: string;
  updatedAt?: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  evidenceIds?: string[];
  paperIds?: string[];
};

export type GraphNode = {
  id: string;
  label: string;
  type: string;
  count?: number;
  year?: number;
  venue?: string;
};

export type GraphEdge = {
  id: string;
  source: string;
  target: string;
  label: string;
  confidence?: number;
};

export type KnowledgeGraph = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

export type Artifact = {
  filename: string;
  url: string;
  contentType?: string;
};

export type WorkspaceSummaryInfo = {
  id: string;
  topic: string;
  status: string;
  paperCount: number;
  factCount: number;
  createdAt: string;
  updatedAt: string;
};
