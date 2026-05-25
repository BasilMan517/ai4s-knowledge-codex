import { config } from "./config.js";

function reconstructAbstract(invertedIndex) {
  if (!invertedIndex) return "";
  const entries = [];
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const position of positions) entries[position] = word;
  }
  return entries.filter(Boolean).join(" ");
}

function normalizeConcepts(work) {
  return [...new Set([
    ...(work.concepts || []).slice(0, 8).map((concept) => concept.display_name),
    ...(work.keywords || []).slice(0, 8).map((keyword) => keyword.display_name)
  ].filter(Boolean))];
}

function doiFromOpenAlex(doi) {
  return doi ? doi.replace(/^https:\/\/doi.org\//, "") : "";
}

function mapWork(work) {
  const authors = (work.authorships || [])
    .slice(0, 8)
    .map((authorship) => authorship.author?.display_name)
    .filter(Boolean)
    .join("; ");

  return {
    id: work.id?.replace("https://openalex.org/", "openalex-") || crypto.randomUUID(),
    openalexId: work.id,
    title: work.title || work.display_name || "Untitled work",
    authors,
    doi: doiFromOpenAlex(work.doi),
    venue:
      work.primary_location?.source?.display_name ||
      work.host_venue?.display_name ||
      work.locations?.[0]?.source?.display_name ||
      "",
    year: work.publication_year,
    publishedDate: work.publication_date,
    url: work.doi || work.primary_location?.landing_page_url || work.id,
    labels: normalizeConcepts(work),
    abstract: reconstructAbstract(work.abstract_inverted_index),
    citationCount: work.cited_by_count || 0,
    relevanceScore: work.relevance_score || 0,
    source: "OpenAlex"
  };
}

function normalizeKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function uniqueByTitleOrDoi(papers) {
  const seen = new Set();
  const result = [];
  for (const paper of papers) {
    const key = normalizeKey(paper.doi || paper.title);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(paper);
  }
  return result;
}

export async function searchOpenAlex(topic, options = {}) {
  const limit = typeof options === "number" ? options : options.limit || 40;
  const fromYear = typeof options === "object" ? options.fromYear : undefined;
  const params = new URLSearchParams({
    search: topic,
    per_page: String(Math.min(Math.max(limit, 1), 100)),
    sort: "relevance_score:desc"
  });

  if (fromYear) {
    params.set("filter", `from_publication_date:${fromYear}-01-01`);
  }

  if (config.openAlexMailto) params.set("mailto", config.openAlexMailto);

  const url = `https://api.openalex.org/works?${params.toString()}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": config.openAlexMailto
        ? `ai4s-knowledge-codex mailto:${config.openAlexMailto}`
        : "ai4s-knowledge-codex"
    }
  });

  if (!response.ok) {
    throw new Error(`OpenAlex request failed: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  return uniqueByTitleOrDoi((payload.results || [])
    .map(mapWork)
    .filter((paper) => paper.title && (paper.abstract || paper.labels.length)));
}
