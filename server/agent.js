import OpenAI from "openai";
import { config } from "./config.js";
import { contextForModel, graphToMermaid, makeFallbackAnswer, retrieve, summarizeWorkspace } from "./kb.js";

export function getClient() {
  if (!config.openaiApiKey) return null;
  return new OpenAI({
    apiKey: config.openaiApiKey,
    baseURL: config.openaiBaseUrl || undefined
  });
}

export function responseText(response) {
  if (response.output_text) return response.output_text;
  return (response.output || [])
    .flatMap((item) => item.content || [])
    .map((content) => content.text || "")
    .filter(Boolean)
    .join("\n");
}

export async function answerQuestion(workspace, question) {
  let evidence = retrieve(workspace, question, 6);
  if (!evidence.length) {
    evidence = retrieve(workspace, workspace.topic, 6);
  }
  const client = getClient();

  if (!client) {
    return {
      answer: makeFallbackAnswer(workspace, question, evidence),
      evidence,
      model: "local-fallback"
    };
  }

  const prompt = `You are a research assistant grounded in a curated knowledge base.

Rules:
- Answer in the same language as the user's question.
- Be concise: 1-3 short paragraphs. No exhaustive literature reviews.
- At the end, list the papers you referenced as "[id] Author, Year" — only the ones you actually used, not all of them.
- If evidence is insufficient, say so briefly.

${contextForModel(workspace, evidence)}

Question: ${question}`;

  const response = await client.responses.create({
    model: config.openaiModel,
    input: prompt
  });

  return {
    answer: responseText(response),
    evidence,
    model: config.openaiModel
  };
}

export async function generateArtifact(workspace, kind, instruction = "") {
  const client = getClient();
  const baseContext = contextForModel(workspace, retrieve(workspace, workspace.topic, 20));

  if (kind === "graph-json") {
    return {
      filename: "knowledge-graph.json",
      content: JSON.stringify(workspace.graph, null, 2),
      contentType: "application/json;charset=utf-8"
    };
  }

  if (kind === "graph-mermaid") {
    return {
      filename: "knowledge-graph.mmd",
      content: graphToMermaid(workspace),
      contentType: "text/plain;charset=utf-8"
    };
  }

  if (kind === "facts-csv") {
    const header = "paper_id,subject,predicate,object,confidence,evidence\n";
    const rows = workspace.facts
      .map((fact) =>
        [fact.paperId, fact.subject, fact.predicate, fact.object, fact.confidence, fact.evidence]
          .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");
    return {
      filename: "facts.csv",
      content: `${header}${rows}`,
      contentType: "text/csv;charset=utf-8"
    };
  }

  if (!client) {
    if (kind === "codex-context") {
      return {
        filename: "codex-context.md",
        content: baseContext,
        contentType: "text/markdown;charset=utf-8"
      };
    }

    if (kind === "materials-analysis") {
      const fallbackMaterials = `# ${workspace.topic} Materials Analysis

OPENAI_API_KEY is not configured, so this file was generated from local structured facts.

## Material Systems
${workspace.facts
  .filter((fact) => fact.predicate === "studies_material_system")
  .slice(0, 40)
  .map((fact) => `- ${fact.object}: ${fact.subject}`)
  .join("\n") || "- No material-system facts extracted yet."}

## Target Properties
${workspace.facts
  .filter((fact) => fact.predicate === "targets_property")
  .slice(0, 40)
  .map((fact) => `- ${fact.object}: ${fact.subject}`)
  .join("\n") || "- No target-property facts extracted yet."}

## Methods
${workspace.facts
  .filter((fact) => fact.predicate === "uses_method")
  .slice(0, 40)
  .map((fact) => `- ${fact.object}: ${fact.subject}`)
  .join("\n") || "- No method facts extracted yet."}
`;
      return {
        filename: "materials-analysis.md",
        content: fallbackMaterials,
        contentType: "text/markdown;charset=utf-8"
      };
    }

    const fallback = `# ${workspace.topic} Research Brief

OPENAI_API_KEY is not configured, so this file was generated from local retrieval only.

${summarizeWorkspace(workspace)}

## Top Clusters
${workspace.clusters.map((cluster) => `- ${cluster.label}: ${cluster.paperIds.length} papers`).join("\n")}

## Top Facts
${workspace.facts
  .slice(0, 30)
  .map((fact) => `- ${fact.subject} | ${fact.predicate} | ${fact.object}`)
  .join("\n")}
`;
    return {
      filename: "research-brief.md",
      content: fallback,
      contentType: "text/markdown;charset=utf-8"
    };
  }

  const artifactPrompts = {
    report: `Write a concise but substantive Markdown research brief for this AI4S topic. Include: landscape, method taxonomy, material systems, knowledge graph interpretation, missing evidence, and next research actions. Cite paper titles/DOIs from context.`,
    "materials-analysis": `Produce a Markdown materials-system analysis. Focus on material families, target properties, experimental/computational methods, data gaps, and candidate hypotheses. Cite evidence from context.`,
    "codex-context": `Create a Codex-ready context file. Include workspace summary, key papers, structured facts, knowledge graph schema, useful search/query tasks, and grounding rules.`
  };

  const task = artifactPrompts[kind] || artifactPrompts.report;
  const response = await client.responses.create({
    model: config.openaiModel,
    input: `${task}

Additional user instruction:
${instruction || "None"}

${baseContext}`
  });

  const filename =
    kind === "materials-analysis"
      ? "materials-analysis.md"
      : kind === "codex-context"
        ? "codex-context.md"
        : "research-brief.md";

  return {
    filename,
    content: responseText(response),
    contentType: "text/markdown;charset=utf-8"
  };
}
