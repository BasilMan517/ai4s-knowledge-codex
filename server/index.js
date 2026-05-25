import cors from "cors";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { answerQuestion, generateArtifact } from "./agent.js";
import { config } from "./config.js";
import { buildKnowledgeBase, retrieve } from "./kb.js";
import { searchOpenAlex } from "./openalex.js";
import {
  ensureStorage,
  listArtifacts,
  listWorkspaces,
  loadWorkspace,
  readArtifact,
  saveWorkspace,
  writeArtifact
} from "./storage.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const app = express();

app.use(cors());
app.use(express.json({ limit: "5mb" }));

app.get("/api/health", (_request, response) => {
  response.json({
    ok: true,
    openaiConfigured: Boolean(config.openaiApiKey),
    model: config.openaiModel
  });
});

app.get("/api/workspaces", async (_request, response, next) => {
  try {
    response.json({ workspaces: await listWorkspaces() });
  } catch (error) {
    next(error);
  }
});

app.post("/api/workspaces", async (request, response, next) => {
  try {
    const topic = String(request.body.topic || "").trim();
    const limit = Number(request.body.limit || 40);
    const fromYear = Number(request.body.fromYear || 2018);
    if (!topic) {
      response.status(400).json({ error: "topic is required" });
      return;
    }

    const papers = await searchOpenAlex(topic, { limit, fromYear });
    const workspace = buildKnowledgeBase(topic, papers);
    await saveWorkspace(workspace);
    response.status(201).json({ workspace, artifacts: await listArtifacts(workspace.id) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/workspaces/:workspaceId", async (request, response, next) => {
  try {
    const workspace = await loadWorkspace(request.params.workspaceId);
    response.json({ workspace, artifacts: await listArtifacts(workspace.id) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/workspaces/:workspaceId/retrieve", async (request, response, next) => {
  try {
    const workspace = await loadWorkspace(request.params.workspaceId);
    const query = String(request.body.query || workspace.topic);
    response.json({ evidence: retrieve(workspace, query, Number(request.body.limit || 12)) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/workspaces/:workspaceId/chat", async (request, response, next) => {
  try {
    const workspace = await loadWorkspace(request.params.workspaceId);
    const question = String(request.body.message || "").trim();
    if (!question) {
      response.status(400).json({ error: "message is required" });
      return;
    }

    response.json(await answerQuestion(workspace, question));
  } catch (error) {
    next(error);
  }
});

app.post("/api/workspaces/:workspaceId/artifacts", async (request, response, next) => {
  try {
    const workspace = await loadWorkspace(request.params.workspaceId);
    const kind = String(request.body.kind || "report");
    const instruction = String(request.body.instruction || "");
    const artifact = await generateArtifact(workspace, kind, instruction);
    const saved = await writeArtifact(workspace.id, artifact.filename, artifact.content);
    response.json({ artifact: { ...saved, contentType: artifact.contentType } });
  } catch (error) {
    next(error);
  }
});

app.get("/api/workspaces/:workspaceId/artifacts", async (request, response, next) => {
  try {
    response.json({ artifacts: await listArtifacts(request.params.workspaceId) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/workspaces/:workspaceId/artifacts/:filename", async (request, response, next) => {
  try {
    const file = await readArtifact(request.params.workspaceId, request.params.filename);
    response.setHeader("Content-Disposition", `attachment; filename="${request.params.filename}"`);
    response.send(file);
  } catch (error) {
    next(error);
  }
});

app.use(express.static(path.join(rootDir, "dist")));
app.get("*", (_request, response) => {
  response.sendFile(path.join(rootDir, "dist", "index.html"));
});

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({
    error: error instanceof Error ? error.message : "Unknown server error"
  });
});

await ensureStorage();

app.listen(config.port, config.host, () => {
  console.log(`AI4S Knowledge Codex server listening on http://${config.host}:${config.port}`);
});
