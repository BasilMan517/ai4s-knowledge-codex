import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const dataDir = path.join(rootDir, "data");
const workspaceDir = path.join(dataDir, "workspaces");
const outputsDir = path.join(rootDir, "outputs");

export async function ensureStorage() {
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
  await ensureStorage();
  await fs.writeFile(getWorkspacePath(workspace.id), JSON.stringify(workspace, null, 2));
}

export async function loadWorkspace(workspaceId) {
  const raw = await fs.readFile(getWorkspacePath(workspaceId), "utf8");
  return JSON.parse(raw);
}

export async function listWorkspaces() {
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
  return fs.readFile(path.join(getOutputDir(workspaceId), filename));
}
