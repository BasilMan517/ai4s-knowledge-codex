import type { Paper } from "../types";

export const demoPapers: Paper[] = [
  {
    id: "paper-llmb-2026",
    title: "LLMB: AI Agent for Lithium Metal Battery Research Using Large Language Model",
    authors: "Jaewoong Lee; Junhee Woo; Younghun Kim; Sejin Kim; Jihan Kim",
    doi: "10.1021/acscentsci.5c02433",
    venue: "ACS Central Science",
    year: 2026,
    labels: ["LLM agent", "electrolyte", "lithium metal battery", "knowledge extraction"],
    url: "https://doi.org/10.1021/acscentsci.5c02433",
    relevanceScore: 20.2,
    source: "Built-in demo corpus",
    abstract:
      "Introduces an AI agent for lithium metal battery research that integrates a large language model, hierarchical text mining, graph data extraction, material-property database construction, machine learning analysis, and experimental validation."
  },
  {
    id: "paper-spectraquery-2026",
    title: "SpectraQuery: A Hybrid Retrieval-Augmented Conversational Assistant for Battery Science",
    authors: "Battery science research team",
    venue: "arXiv",
    year: 2026,
    labels: ["RAG", "conversational assistant", "battery science", "SQL query"],
    url: "https://arxiv.org/abs/2601.09036",
    relevanceScore: 18.9,
    source: "Built-in demo corpus",
    abstract:
      "Presents a retrieval-augmented conversational assistant for battery science that combines semantic retrieval with structured SQL-style querying, citation grounding, and expert evaluation of answer quality."
  },
  {
    id: "paper-ionic-conductivity-2026",
    title:
      "Data-driven prediction of ionic conductivity in solid-state electrolytes with machine learning and large language models",
    authors: "Haewon Kim; Taekgi Lee; Seongeun Hong; Kyeong-Ho Kim; Yongchul G. Chung",
    doi: "10.1063/5.0307954",
    venue: "The Journal of Chemical Physics",
    year: 2026,
    labels: ["solid-state electrolyte", "ionic conductivity", "machine learning", "LLM"],
    url: "https://doi.org/10.1063/5.0307954",
    relevanceScore: 21.2,
    source: "Built-in demo corpus",
    abstract:
      "Studies data-driven prediction of room-temperature ionic conductivity in solid-state electrolytes, combining machine learning features and large-language-model support for screening and interpretation."
  },
  {
    id: "paper-autosee-2026",
    title: "AutoSEE: An Artificial Intelligence Agent for Automated Solid Electrolyte Exploration",
    authors: "Solid electrolyte automation research team",
    doi: "10.1021/acsenergylett.6c00020",
    venue: "ACS Energy Letters",
    year: 2026,
    labels: ["AI agent", "solid electrolyte", "automation", "materials discovery"],
    url: "https://doi.org/10.1021/acsenergylett.6c00020",
    relevanceScore: 19.4,
    source: "Built-in demo corpus",
    abstract:
      "Describes an artificial intelligence agent designed for automated exploration of solid electrolyte candidates, connecting literature-derived knowledge, candidate prioritization, and experimental planning."
  },
  {
    id: "paper-bayes-cathode-2026",
    title: "Navigating Ternary Doping in Li-ion Cathodes With Closed-Loop Multi-Objective Bayesian Optimization",
    authors: "Nooshin Zeinali Galabi; Chenghao Liu; Moksh Jain; Yoshua Bengio; Eric McCalla",
    doi: "10.1002/adma.202519790",
    venue: "Advanced Materials",
    year: 2026,
    labels: ["Bayesian optimization", "active learning", "cathode", "multi-objective optimization"],
    url: "https://doi.org/10.1002/adma.202519790",
    relevanceScore: 20.2,
    source: "Built-in demo corpus",
    abstract:
      "Uses closed-loop multi-objective Bayesian optimization for ternary doping in lithium-ion cathodes, coupling prior materials data, surrogate modeling, and experiment selection."
  },
  {
    id: "paper-open-electrolyte-db-2026",
    title: "Open electrolyte database generated via an automated molecular dynamics simulation framework",
    authors: "Electrolyte simulation research team",
    doi: "10.1038/s41524-026-02093-y",
    venue: "npj Computational Materials",
    year: 2026,
    labels: ["electrolyte", "database", "molecular dynamics", "simulation"],
    url: "https://doi.org/10.1038/s41524-026-02093-y",
    relevanceScore: 18.4,
    source: "Built-in demo corpus",
    abstract:
      "Builds an open electrolyte database using an automated molecular dynamics simulation workflow, creating structured property data for electrolyte screening and downstream machine learning."
  },
  {
    id: "paper-chatmof-2024",
    title: "ChatMOF: An artificial intelligence system for predicting and generating metal-organic frameworks",
    authors: "MOF informatics research team",
    venue: "Materials informatics preprint",
    year: 2024,
    labels: ["LLM", "MOF", "generation", "materials discovery"],
    source: "Built-in demo corpus",
    abstract:
      "Demonstrates how a conversational AI system can help predict, retrieve, and generate metal-organic framework candidates, showing a broader template for topic-specific materials assistants."
  },
  {
    id: "paper-gnome-2023",
    title: "Scaling deep learning for materials discovery",
    authors: "Google DeepMind materials team",
    venue: "Nature",
    year: 2023,
    labels: ["graph neural network", "crystal discovery", "DFT", "large-scale screening"],
    url: "https://www.nature.com/articles/s41586-023-06735-9",
    source: "Built-in demo corpus",
    abstract:
      "Reports large-scale crystal discovery using graph neural networks and high-throughput computational filtering, highlighting the value of structured materials data and validation loops."
  },
  {
    id: "paper-chemcrow-2024",
    title: "Augmenting large language models with chemistry tools",
    authors: "ChemCrow research team",
    venue: "Nature Machine Intelligence",
    year: 2024,
    labels: ["tool-using agent", "chemistry", "planning", "automation"],
    url: "https://www.nature.com/articles/s42256-024-00832-8",
    source: "Built-in demo corpus",
    abstract:
      "Presents a chemistry agent that augments language models with specialized tools for search, calculation, planning, and synthesis-related workflows. It is a useful pattern for a Codex-ready AI4S tool layer."
  },
  {
    id: "paper-batterybert-2022",
    title: "BatteryBERT: A pretrained language model for battery database enhancement",
    authors: "Battery text mining research team",
    venue: "Journal of Chemical Information and Modeling",
    year: 2022,
    labels: ["text mining", "battery database", "pretrained language model", "entity extraction"],
    source: "Built-in demo corpus",
    abstract:
      "Shows how battery literature can be mined with domain language models to improve database construction, entity extraction, and structured battery knowledge curation."
  }
];
