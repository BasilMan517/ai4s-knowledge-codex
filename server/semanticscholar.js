function mapPaper(paper) {
  const authors = (paper.authors || [])
    .slice(0, 8)
    .map((a) => a.name)
    .filter(Boolean)
    .join("; ");

  const doi = paper.externalIds?.DOI || "";
  const arxivId = paper.externalIds?.ArXiv || "";

  return {
    id: paper.paperId ? `s2-${paper.paperId}` : `s2-${crypto.randomUUID()}`,
    s2Id: paper.paperId,
    title: paper.title || "Untitled",
    authors,
    doi,
    venue: paper.venue || paper.publicationVenue?.name || "",
    year: paper.year,
    publishedDate: paper.publicationDate || (paper.year ? `${paper.year}-01-01` : ""),
    url: doi ? `https://doi.org/${doi}` : arxivId ? `https://arxiv.org/abs/${arxivId}` : `https://www.semanticscholar.org/paper/${paper.paperId}`,
    labels: [],
    abstract: paper.abstract || "",
    citationCount: paper.citationCount || 0,
    relevanceScore: 0,
    source: arxivId ? "arXiv" : "Semantic Scholar"
  };
}

function normalizeKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export async function searchSemanticScholar(query, options = {}) {
  const limit = options.limit || 40;
  const fromYear = options.fromYear;

  const params = new URLSearchParams({
    query,
    limit: String(Math.min(limit, 100)),
    fields: "title,authors,year,abstract,venue,externalIds,citationCount,publicationDate,publicationVenue"
  });

  if (fromYear) {
    params.set("year", `${fromYear}-`);
  }

  const url = `https://api.semanticscholar.org/graph/v1/paper/search?${params.toString()}`;

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "ai4s-knowledge-codex" }
    });

    if (!response.ok) {
      console.warn(`Semantic Scholar search failed: ${response.status}`);
      return [];
    }

    const payload = await response.json();
    return (payload.data || [])
      .map(mapPaper)
      .filter((p) => p.title && p.title !== "Untitled" && (p.abstract || p.labels.length));
  } catch (err) {
    console.warn("Semantic Scholar search error:", err.message);
    return [];
  }
}
