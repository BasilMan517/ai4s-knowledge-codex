# AI4S Knowledge Codex MVP

## 1. Product Positioning

This product is a topic-to-expert knowledge system for AI4S.

The user enters a scientific topic. The system builds a focused literature knowledge base from papers and structured metadata, then gives Codex a grounded research environment with search, citation, table query, extraction, and analysis tools.

The first version should not train a new model. The differentiator is the quality of the domain knowledge base and the tool layer exposed to Codex.

Chinese positioning:

> 面向 AI4S 的主题专家知识库生成器。用户输入一个科研方向，系统自动构建该方向的文献知识库，并让 Codex 成为这个方向的专家助手。

## 2. MVP Goal

Given a topic such as `solid-state electrolyte ionic conductivity` or `lithium metal battery electrolyte discovery`, the MVP should:

1. Import a seed paper set from the existing Excel workbook.
2. Normalize paper metadata: title, authors, DOI/arXiv, venue, year, link, labels, abstract.
3. Build searchable full-text-like chunks from available title, abstract, notes, and later PDFs.
4. Extract lightweight structured scientific facts from each paper.
5. Let Codex answer with citations and query the structured knowledge base.
6. Export tables, research maps, and candidate paper lists.

The MVP should prove: "A user can input a research topic and quickly get a grounded expert assistant for that field."

## 3. Current Seed Data

Source file:

`AI4S_电池方向文献100篇_最终版_20260506_2223.xlsx`

Sheets:

- `Top100_最终`: curated top 100 papers.
- `指定作者团队_初筛`: author/team hits.
- `候选池_清洗去重`: cleaned candidate pool, 330 records.
- `检索说明`: search and filtering notes.

Useful columns:

- `序号`
- `文章名称`
- `文章作者`
- `DOI/arXiv`
- `DOI/arXiv校验状态`
- `期刊/平台`
- `发布时间`
- `年份`
- `AI4S方向标签`
- `指定作者/团队命中`
- `机构信息`
- `引用数(OpenAlex)`
- `链接`
- `OpenAlex ID`
- `检索来源`
- `相关性评分`
- `摘要/核心内容摘录`

Observed Top100 theme distribution:

- `SOH/RUL/退化预测`: 45
- `电解质`: 43
- `固态电池/固态电解质`: 25
- `电极材料`: 14
- `基础模型/LLM`: 13
- `主动学习/贝叶斯优化`: 9
- `预训练/自监督`: 6
- `后训练/微调`: 5
- `图神经网络`: 3
- `生成模型`: 2

Recommendation for the first demo topic:

`solid-state electrolyte / electrolyte material discovery`

Reason: it is closer to material discovery than SOH/RUL, and the seed list already includes LLM agents, RAG assistants, active learning, interatomic potentials, ionic conductivity prediction, and electrolyte databases.

## 4. User Experience

### 4.1 First Screen

The first screen should be the actual research workspace, not a landing page.

Core UI:

- Topic input.
- Imported paper set.
- Research map.
- Chat panel.
- Citation/evidence panel.
- Structured table panel.
- Export actions.

Example flow:

1. User enters: `固态电解质离子电导率预测`.
2. System loads matching papers from the workbook.
3. System shows topic clusters:
   - ionic conductivity prediction
   - machine-learned interatomic potentials
   - active learning / Bayesian optimization
   - LLM / RAG assistants
   - solid electrolyte roadmap papers
4. User asks: `找出这些论文中关于 Li solid electrolyte ionic conductivity 的数据和方法差异`.
5. Codex calls tools:
   - `search_papers`
   - `search_chunks`
   - `query_facts`
   - `make_evidence_table`
6. Answer includes citations and a table.

### 4.2 Example Questions

- `这个方向最近的主流技术路线是什么？`
- `哪些论文用了 RAG 或 LLM agent？`
- `列出固态电解质离子电导率预测相关论文。`
- `把所有涉及 Bayesian optimization 的论文导出成 CSV。`
- `比较 LLMB、SpectraQuery、AutoSEE 的系统架构。`
- `生成一个该方向的 research map。`
- `根据现有论文，下一步应该补哪些数据？`
- `写一个 Python 脚本，把这些论文按方向标签和年份可视化。`

## 5. System Architecture

```text
                 +----------------------+
                 | Topic / Paper Import |
                 +----------+-----------+
                            |
                            v
                 +----------------------+
                 | Metadata Normalizer  |
                 +----------+-----------+
                            |
          +-----------------+-----------------+
          |                                   |
          v                                   v
+-------------------+              +---------------------+
| Vector Knowledge  |              | Structured Database |
| chunks + metadata |              | papers/facts/entities|
+---------+---------+              +----------+----------+
          |                                   |
          +-----------------+-----------------+
                            |
                            v
                 +----------------------+
                 | Codex Tool Layer     |
                 +----------+-----------+
                            |
                            v
                 +----------------------+
                 | Expert Chat UI       |
                 +----------------------+
```

Core design choice:

Use two stores, not one.

- Vector store for semantic retrieval over paper text.
- Relational store for exact filters, tables, citations, entities, and extracted facts.

## 6. Data Schema

### 6.1 `papers`

One row per paper.

```sql
create table papers (
  id text primary key,
  source_sheet text not null,
  source_row integer,
  title text not null,
  authors text,
  doi text,
  arxiv_id text,
  venue text,
  published_date text,
  year integer,
  ai4s_labels text,
  team_hit text,
  institutions text,
  citation_count integer,
  url text,
  openalex_id text,
  search_source text,
  relevance_score real,
  abstract text,
  created_at text not null,
  updated_at text not null
);
```

### 6.2 `paper_chunks`

Chunks used for RAG.

```sql
create table paper_chunks (
  id text primary key,
  paper_id text not null references papers(id),
  chunk_index integer not null,
  chunk_type text not null,
  text text not null,
  token_count integer,
  page_start integer,
  page_end integer,
  section_title text,
  table_or_figure_ref text,
  citation_anchor text,
  embedding_model text,
  created_at text not null
);
```

`chunk_type` examples:

- `title_abstract`
- `abstract`
- `full_text`
- `table`
- `figure_caption`
- `extracted_note`
- `user_note`

### 6.3 `entities`

Scientific entities normalized across papers.

```sql
create table entities (
  id text primary key,
  name text not null,
  entity_type text not null,
  normalized_name text,
  formula text,
  synonyms text,
  created_at text not null
);
```

`entity_type` examples:

- `material`
- `chemical`
- `battery_type`
- `property`
- `method`
- `dataset`
- `instrument`
- `model`
- `task`

### 6.4 `paper_entities`

Many-to-many relation between papers and entities.

```sql
create table paper_entities (
  paper_id text not null references papers(id),
  entity_id text not null references entities(id),
  role text,
  evidence_chunk_id text references paper_chunks(id),
  confidence real,
  primary key (paper_id, entity_id, role)
);
```

`role` examples:

- `studied_material`
- `target_property`
- `prediction_method`
- `synthesis_method`
- `dataset_used`
- `evaluation_metric`

### 6.5 `facts`

The most important table for AI4S value.

```sql
create table facts (
  id text primary key,
  paper_id text not null references papers(id),
  subject_entity_id text references entities(id),
  predicate text not null,
  object_value text,
  object_entity_id text references entities(id),
  numeric_value real,
  unit text,
  conditions_json text,
  method text,
  evidence_chunk_id text references paper_chunks(id),
  evidence_text text,
  confidence real,
  created_at text not null
);
```

Example facts:

- `LLZO | has_property | ionic conductivity | 1e-3 | S/cm | room temperature`
- `LLMB | uses_method | hierarchical text mining`
- `SpectraQuery | uses_method | retrieval augmented generation`
- `paper X | target_task | SOH prediction`
- `paper Y | optimization_method | Bayesian optimization`

### 6.6 `topic_runs`

Each user-created topic workspace.

```sql
create table topic_runs (
  id text primary key,
  topic text not null,
  normalized_topic text,
  query_plan_json text,
  status text not null,
  created_at text not null,
  updated_at text not null
);
```

### 6.7 `topic_papers`

Paper membership and ranking for a topic.

```sql
create table topic_papers (
  topic_run_id text not null references topic_runs(id),
  paper_id text not null references papers(id),
  rank integer,
  relevance_score real,
  inclusion_reason text,
  primary key (topic_run_id, paper_id)
);
```

## 7. Codex Tool Layer

The product should expose tools to Codex. The LLM should not directly inspect database internals; it should call stable APIs.

### 7.1 `search_papers`

Purpose: find papers by topic, label, year, DOI, author, venue, or keywords.

Input:

```json
{
  "query": "solid electrolyte ionic conductivity",
  "labels": ["电解质", "固态电池/固态电解质"],
  "year_from": 2024,
  "limit": 20
}
```

Output:

```json
{
  "papers": [
    {
      "paper_id": "paper_0003",
      "title": "Data-driven prediction of ionic conductivity in solid-state electrolytes with machine learning and large language models",
      "year": 2026,
      "venue": "The Journal of Chemical Physics",
      "doi": "10.1063/5.0307954",
      "relevance_score": 21.2,
      "matched_fields": ["title", "labels", "abstract"]
    }
  ]
}
```

### 7.2 `search_chunks`

Purpose: semantic search over paper chunks.

Input:

```json
{
  "query": "Which papers use RAG or LLM agents for battery research?",
  "topic_run_id": "topic_001",
  "limit": 10
}
```

Output should include text snippets and citation anchors.

### 7.3 `query_facts`

Purpose: exact/structured scientific queries.

Input:

```json
{
  "entity_type": "method",
  "predicate": "uses_method",
  "object_contains": "Bayesian optimization",
  "limit": 50
}
```

### 7.4 `get_paper`

Purpose: load full metadata, chunks, entities, and facts for a paper.

Input:

```json
{
  "paper_id": "paper_0008",
  "include_chunks": true,
  "include_facts": true
}
```

### 7.5 `make_evidence_table`

Purpose: produce a cited table from papers/chunks/facts.

Input:

```json
{
  "question": "Compare LLMB, SpectraQuery, and AutoSEE",
  "columns": ["system", "task", "data source", "methods", "outputs", "evidence"],
  "paper_ids": ["paper_0008", "paper_0016", "paper_0033"]
}
```

### 7.6 `export_dataset`

Purpose: export selected papers/facts/chunks as CSV/JSON.

Input:

```json
{
  "type": "facts",
  "filters": {
    "predicate": "target_property",
    "object_contains": "ionic conductivity"
  },
  "format": "csv"
}
```

### 7.7 `run_analysis_code`

Purpose: let Codex run local analysis on exported tables.

Guardrails:

- Read-only by default.
- Explicit user approval before network access or destructive writes.
- Store generated artifacts under `outputs/`.

## 8. RAG And Citation Rules

The assistant must be grounded by default.

Answer policy:

1. For claims about papers, cite at least one paper.
2. For comparisons, cite each compared item.
3. For numeric material properties, include unit and experimental/computational condition when available.
4. If evidence comes only from title/abstract, say so.
5. If the database does not contain enough evidence, say what is missing.
6. Do not infer material performance from paper titles alone.

Citation format:

```text
[paper_0008: LLMB, ACS Central Science, 2026, DOI ...]
```

Later, this can become clickable source cards.

## 9. Extraction Strategy

Do extraction in stages. Do not try to solve all PDF understanding at once.

### Stage 1: Workbook Metadata

Extract:

- paper metadata
- topic labels
- abstract/core excerpt
- source query
- relevance score

This gives an immediate working demo.

### Stage 2: Light Scientific Entities

Use LLM extraction on title + abstract:

- materials
- battery type
- target property
- ML method
- task
- dataset
- evaluation metric

Store evidence text and confidence.

### Stage 3: PDF/Text Ingestion

When PDFs are available:

- parse sections
- parse references
- parse tables
- parse figure captions
- keep page numbers
- preserve table/figure anchors

### Stage 4: High-Value Fact Extraction

For battery materials:

- material/composition
- property
- value
- unit
- temperature
- pressure if relevant
- cycling condition
- current density / C-rate
- voltage window
- synthesis route
- model method
- validation type

## 10. Frontend MVP

Use a simple workbench layout.

```text
+------------------------------------------------------------+
| Topic bar: [ solid-state electrolyte ionic conductivity ]   |
+----------------------+----------------------+--------------+
| Paper Set            | Chat                 | Evidence     |
| filters/clusters     | Codex answers        | citations    |
| paper list           | tool calls/results   | snippets     |
+----------------------+----------------------+--------------+
| Structured Tables / Research Map / Exports                 |
+------------------------------------------------------------+
```

Required views:

- Topic setup
- Paper browser
- Chat
- Evidence panel
- Structured facts table
- Research map
- Export panel

Research map for MVP:

- group by `AI4S方向标签`
- show top papers per cluster
- show methods: RAG, LLM agent, active learning, GNN, interatomic potential, SOH/RUL
- show gaps: missing PDF, missing property values, missing conditions

## 11. Backend MVP

Recommended stack:

- Python ingestion pipeline.
- SQLite for local MVP.
- Chroma or LanceDB for vector search.
- FastAPI for API endpoints.
- A Codex-compatible tool server later.
- React/Next.js or Streamlit for the first UI, depending on speed.

For the first working prototype, prefer:

- Python + SQLite + LanceDB/Chroma
- Streamlit if speed matters most
- FastAPI + Next.js if product polish matters more

Directory layout:

```text
data/
  raw/
    AI4S_电池方向文献100篇_最终版_20260506_2223.xlsx
  processed/
    papers.db
    chunks.jsonl
    facts.jsonl
src/
  ingestion/
    import_excel.py
    normalize.py
    chunk.py
    extract_entities.py
  kb/
    db.py
    vector_store.py
    search.py
  tools/
    search_papers.py
    search_chunks.py
    query_facts.py
    export_dataset.py
  app/
    api.py
    ui.py
docs/
  ai4s-knowledge-codex-mvp.md
outputs/
```

## 12. MVP Milestones

### Milestone 1: Local Knowledge Base

Deliverables:

- Import Excel.
- Create SQLite database.
- Insert `papers`.
- Generate `paper_chunks` from title + abstract.
- Basic keyword search.
- Basic topic filters.

Success test:

User asks: `哪些论文和 LLM agent 有关？`

System returns LLMB, SpectraQuery, AutoSEE-like papers with citations.

### Milestone 2: Structured Extraction

Deliverables:

- Extract `entities`.
- Extract lightweight `facts`.
- Show structured facts table.
- Export CSV.

Success test:

User asks: `列出所有涉及 Bayesian optimization 的电池材料发现论文。`

System returns a table with title, target material/property, method, and evidence.

### Milestone 3: Codex Tool Integration

Deliverables:

- Expose stable tool functions.
- Codex can call search/query/export tools.
- Answers include citations.
- Tool call logs visible in UI.

Success test:

User asks: `比较 LLMB、SpectraQuery、AutoSEE 的架构，并指出我们的 MVP 应该借鉴什么。`

System calls search and evidence table tools, then answers with citations.

### Milestone 4: Research Map

Deliverables:

- Cluster papers by label/method/task.
- Generate topic map.
- Identify evidence gaps.
- Export markdown report.

Success test:

User asks: `生成固态电解质 AI4S 方向的 research map。`

System outputs clusters, representative papers, methods, and gaps.

## 13. Evaluation

Evaluate the knowledge system before evaluating chat quality.

Metrics:

- Paper import completeness.
- DOI/arXiv normalization accuracy.
- Search recall for known target papers.
- Citation correctness.
- Entity extraction precision.
- Fact extraction precision.
- Unit normalization accuracy.
- Unsupported-claim rate in answers.

Manual evaluation set:

Create 20 questions from the seed workbook:

- 5 literature search questions.
- 5 method comparison questions.
- 5 structured table questions.
- 5 synthesis/research-map questions.

Each answer is scored:

- `0`: unsupported or wrong.
- `1`: partially correct, weak citation.
- `2`: correct and grounded.

## 14. What Not To Build In V1

Do not build these in the first version:

- Training a new foundation model.
- Fine-tuning a domain chat model.
- Fully automatic paper acceptance without human review.
- Deep PDF table extraction before workbook ingestion works.
- Experimental candidate generation without evidence tracking.
- A generic all-science search engine.

The MVP should stay narrow:

Battery AI4S topic -> curated knowledge base -> grounded Codex expert.

## 15. Immediate Next Implementation Plan

1. Create ingestion script for the Excel workbook.
2. Generate a SQLite database with `papers`, `paper_chunks`, `entities`, and `facts`.
3. Build local search functions.
4. Build a simple CLI demo:
   - `search papers`
   - `search chunks`
   - `query facts`
   - `export`
5. Add a minimal UI after the CLI works.

The CLI should come before UI because it defines the tool API Codex will use.

