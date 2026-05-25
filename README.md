# AI4S Knowledge Codex

AI4S Knowledge Codex is a topic-to-expert research workbench. It turns a scientific topic and a paper set into a grounded, cited knowledge workspace that can be used directly by Codex or another LLM.

The MVP is intentionally model-free: it does not train a new foundation model. It focuses on paper ingestion, structured metadata, retrieval, evidence tables, research maps, and Codex-ready context packages.

## What It Does

- Starts from a user-entered AI4S topic.
- Automatically searches OpenAlex for related papers.
- Builds a local literature knowledge base from paper metadata, concepts, and abstracts.
- Derives entities, structured facts, clusters, and a knowledge graph.
- Uses OpenAI's API when `OPENAI_API_KEY` is configured.
- Falls back to local retrieval when no API key is present.
- Generates files such as research briefs, materials analyses, graph JSON, and facts CSV.

## Run Locally

```bash
npm install
npm run dev
```

Then open the Vite URL printed by the terminal. The backend runs on `http://127.0.0.1:8787`.

## Configure OpenAI

Create `.env` from the example:

```bash
cp .env.example .env
```

Set:

```bash
OPENAI_API_KEY=your_key_here
OPENAI_BASE_URL=
OPENAI_MODEL=gpt-5.5
```

Without a key, the app still builds knowledge bases and generates fallback reports from local retrieval.

For OpenAI-compatible routers such as TokenRouter, set:

```bash
TOKENROUTER_API_KEY=your_router_key_here
OPENAI_BASE_URL=https://api.tokenrouter.com/v1
OPENAI_MODEL=your_router_model_id
```

## Build

```bash
npm run build
npm start
```

`npm start` serves the built frontend and backend from one Express server.

## API

Core endpoints:

- `POST /api/workspaces`: create a topic workspace and build a knowledge base.
- `GET /api/workspaces/:id`: load a workspace.
- `POST /api/workspaces/:id/chat`: ask grounded questions.
- `POST /api/workspaces/:id/artifacts`: generate files.
- `GET /api/workspaces/:id/artifacts/:filename`: download generated files.

## Product Direction

The long-term product is a general AI4S knowledge workspace:

```text
topic -> OpenAlex papers -> knowledge base -> knowledge graph -> Codex tool layer -> files and analysis
```

See [docs/ai4s-knowledge-codex-mvp.md](docs/ai4s-knowledge-codex-mvp.md) for the detailed MVP plan.

See [docs/open-source-landscape.md](docs/open-source-landscape.md) for the open-source references that informed the architecture.
