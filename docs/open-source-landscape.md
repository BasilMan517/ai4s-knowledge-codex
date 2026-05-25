# Open Source Landscape

This project is not trying to clone a generic RAG framework. It uses the useful patterns from existing systems, then narrows the product around AI4S topic workspaces.

## Relevant Projects

### OpenAlex

OpenAlex is the first literature acquisition backend in this prototype.

Useful pieces:

- Works search API.
- Title, abstract, authors, venue, DOI, publication year.
- Concepts and keywords for quick topic bootstrapping.
- Citation counts and related metadata.

Why we use it first:

- No user-provided PDFs are needed for a first workspace.
- It gives enough metadata to build a first knowledge graph.
- It is open enough for a public product demo.

### PaperQA

PaperQA is the closest research-QA reference point.

Useful pieces:

- Scientific-paper retrieval.
- Passage relevance assessment.
- Citation-grounded answers over literature.

Where our product differs:

- We start from a topic, not only a local paper folder.
- We build structured facts and a knowledge graph, not only answer synthesis.
- We generate files and Codex-ready context as primary outputs.

### Microsoft GraphRAG

GraphRAG is the most relevant knowledge-graph RAG architecture reference.

Useful pieces:

- Extract structured entities and relationships from unstructured documents.
- Use graph memory to improve global reasoning over a corpus.
- Treat indexing as a data pipeline, not a single prompt.

Where our product differs:

- We need scientific schema: material, property, method, condition, dataset, evidence.
- We need artifact generation: research brief, materials analysis, graph JSON, facts CSV.
- We need a user-facing topic workspace, not just an indexing pipeline.

### LightRAG

LightRAG is a useful lightweight graph-RAG reference.

Useful pieces:

- Hybrid graph and text retrieval.
- Lighter deployment model than large enterprise GraphRAG stacks.
- Good inspiration for incremental graph updates.

Where our product differs:

- We do not want graph extraction to be generic only; AI4S needs typed scientific facts.
- The product surface is a research workbench, not a backend library.

## Product Takeaway

The product should own the AI4S workflow:

```text
topic -> literature acquisition -> structured scientific KB -> knowledge graph -> Codex tools -> files and analysis
```

The durable value is the scientific schema, evidence tracking, graph quality, and workspace UX.
