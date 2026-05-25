import * as XLSX from "xlsx";
import type { Paper } from "../types";

const COLUMN_ALIASES = {
  title: ["title", "paper title", "文章名称", "标题"],
  authors: ["authors", "author", "文章作者", "作者"],
  doi: ["doi", "doi/arxiv", "DOI/arXiv", "arxiv"],
  venue: ["venue", "journal", "期刊/平台", "期刊"],
  year: ["year", "年份"],
  labels: ["labels", "tags", "AI4S方向标签", "标签"],
  url: ["url", "link", "链接"],
  abstract: ["abstract", "summary", "摘要/核心内容摘录", "摘要"],
  relevanceScore: ["relevanceScore", "score", "相关性评分"]
};

function findValue(row: Record<string, unknown>, aliases: string[]): string {
  const direct = aliases.find((alias) => row[alias] != null);
  if (direct) return String(row[direct] ?? "").trim();

  const normalizedEntries = Object.entries(row).map(([key, value]) => [key.toLowerCase().trim(), value] as const);
  const match = normalizedEntries.find(([key]) => aliases.some((alias) => key === alias.toLowerCase().trim()));
  return String(match?.[1] ?? "").trim();
}

function splitLabels(value: string): string[] {
  return value
    .split(/[;,；、|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function rowToPaper(row: Record<string, unknown>, index: number, source: string): Paper | null {
  const title = findValue(row, COLUMN_ALIASES.title);
  const abstract = findValue(row, COLUMN_ALIASES.abstract);

  if (!title && !abstract) return null;

  const yearText = findValue(row, COLUMN_ALIASES.year);
  const scoreText = findValue(row, COLUMN_ALIASES.relevanceScore);

  return {
    id: `upload-${source.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${index + 1}`,
    title: title || `Untitled paper ${index + 1}`,
    authors: findValue(row, COLUMN_ALIASES.authors),
    doi: findValue(row, COLUMN_ALIASES.doi) || undefined,
    venue: findValue(row, COLUMN_ALIASES.venue) || undefined,
    year: Number.isFinite(Number(yearText)) ? Number(yearText) : undefined,
    labels: splitLabels(findValue(row, COLUMN_ALIASES.labels)),
    url: findValue(row, COLUMN_ALIASES.url) || undefined,
    abstract,
    relevanceScore: Number.isFinite(Number(scoreText)) ? Number(scoreText) : undefined,
    source
  };
}

export async function parsePaperFile(file: File): Promise<Paper[]> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const source = file.name;

  if (extension === "json") {
    const text = await file.text();
    const parsed = JSON.parse(text) as unknown;
    const rows = Array.isArray(parsed) ? parsed : Array.isArray((parsed as { papers?: unknown }).papers) ? (parsed as { papers: unknown[] }).papers : [];
    return rows
      .map((row, index) => rowToPaper(row as Record<string, unknown>, index, source))
      .filter((paper): paper is Paper => Boolean(paper));
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const rows = workbook.SheetNames.flatMap((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  });

  return rows
    .map((row, index) => rowToPaper(row, index, source))
    .filter((paper): paper is Paper => Boolean(paper));
}

export function mergePapers(existing: Paper[], incoming: Paper[]): Paper[] {
  const byKey = new Map<string, Paper>();
  for (const paper of [...existing, ...incoming]) {
    const key = (paper.doi || paper.title).toLowerCase().trim();
    if (!byKey.has(key)) byKey.set(key, paper);
  }
  return [...byKey.values()];
}

export function downloadText(filename: string, content: string, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
