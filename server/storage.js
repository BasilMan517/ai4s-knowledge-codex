import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const dataDir = path.join(rootDir, "data");
const workspaceDir = path.join(dataDir, "workspaces");
const outputsDir = path.join(rootDir, "outputs");

function hasSupabase() {
  return Boolean(config.supabaseUrl && config.supabaseServiceRoleKey);
}

function supabaseHeaders(extra = {}) {
  return {
    apikey: config.supabaseServiceRoleKey,
    Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
    "Content-Type": "application/json",
    ...extra
  };
}

async function supabaseRequest(pathname, init = {}) {
  const baseUrl = config.supabaseUrl.replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/rest/v1/${pathname}`, {
    ...init,
    headers: supabaseHeaders(init.headers || {})
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Supabase storage error ${response.status}: ${text || response.statusText}`);
  }
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

export async function ensureStorage() {
  if (hasSupabase()) return;
  await fs.mkdir(workspaceDir, { recursive: true });
  await fs.mkdir(outputsDir, { recursive: true });
}

export function getWorkspacePath(workspaceId) {
  return path.join(workspaceDir, `${workspaceId}.json`);
}

export function getOutputDir(workspaceId) {
  return path.join(outputsDir, workspaceId);
}

export async function saveWorkspace(workspace) {
  if (hasSupabase()) {
    await supabaseRequest("ai4s_workspaces?on_conflict=id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        id: workspace.id,
        topic: workspace.topic,
        status: workspace.status,
        paper_count: workspace.papers?.length || 0,
        fact_count: workspace.facts?.length || 0,
        workspace,
        created_at: workspace.createdAt,
        updated_at: workspace.updatedAt
      })
    });
    return;
  }
  await ensureStorage();
  const target = getWorkspacePath(workspace.id);
  const tmp = `${target}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(workspace, null, 2));
  await fs.rename(tmp, target);
}

export async function loadWorkspace(workspaceId) {
  if (hasSupabase()) {
    const rows = await supabaseRequest(`ai4s_workspaces?select=workspace&id=eq.${encodeURIComponent(workspaceId)}&limit=1`);
    if (!rows?.length) throw new Error(`Workspace not found: ${workspaceId}`);
    return rows[0].workspace;
  }
  const raw = await fs.readFile(getWorkspacePath(workspaceId), "utf8");
  return JSON.parse(raw);
}

export async function listWorkspaces() {
  if (hasSupabase()) {
    const rows = await supabaseRequest(
      "ai4s_workspaces?select=id,topic,status,paper_count,fact_count,created_at,updated_at&order=updated_at.desc"
    );
    return (rows || []).map((row) => ({
      id: row.id,
      topic: row.topic,
      status: row.status,
      paperCount: row.paper_count || 0,
      factCount: row.fact_count || 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }
  await ensureStorage();
  const files = await fs.readdir(workspaceDir);
  const workspaces = [];
  for (const file of files.filter((name) => name.endsWith(".json"))) {
    const raw = await fs.readFile(path.join(workspaceDir, file), "utf8");
    const workspace = JSON.parse(raw);
    workspaces.push({
      id: workspace.id,
      topic: workspace.topic,
      status: workspace.status,
      paperCount: workspace.papers?.length || 0,
      factCount: workspace.facts?.length || 0,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt
    });
  }
  return workspaces.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

export async function writeArtifact(workspaceId, filename, content) {
  if (hasSupabase()) {
    await supabaseRequest("ai4s_artifacts?on_conflict=workspace_id,filename", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        workspace_id: workspaceId,
        filename,
        content
      })
    });
    return {
      filename,
      url: `/api/workspaces/${workspaceId}/artifacts/${encodeURIComponent(filename)}`
    };
  }
  const dir = getOutputDir(workspaceId);
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, filename);
  await fs.writeFile(filePath, content);
  return {
    filename,
    path: filePath,
    url: `/api/workspaces/${workspaceId}/artifacts/${encodeURIComponent(filename)}`
  };
}

export async function listArtifacts(workspaceId) {
  if (hasSupabase()) {
    const rows = await supabaseRequest(
      `ai4s_artifacts?select=filename&workspace_id=eq.${encodeURIComponent(workspaceId)}&order=updated_at.desc`
    );
    return (rows || []).map((row) => ({
      filename: row.filename,
      url: `/api/workspaces/${workspaceId}/artifacts/${encodeURIComponent(row.filename)}`
    }));
  }
  const dir = getOutputDir(workspaceId);
  try {
    const files = await fs.readdir(dir);
    return files.map((filename) => ({
      filename,
      url: `/api/workspaces/${workspaceId}/artifacts/${encodeURIComponent(filename)}`
    }));
  } catch {
    return [];
  }
}

export async function readArtifact(workspaceId, filename) {
  if (hasSupabase()) {
    const rows = await supabaseRequest(
      `ai4s_artifacts?select=content&workspace_id=eq.${encodeURIComponent(workspaceId)}&filename=eq.${encodeURIComponent(filename)}&limit=1`
    );
    if (!rows?.length) throw new Error(`Artifact not found: ${filename}`);
    return rows[0].content || "";
  }
  return fs.readFile(path.join(getOutputDir(workspaceId), filename));
}
