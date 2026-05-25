import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: Number(process.env.PORT || 8787),
  openaiApiKey: process.env.OPENAI_API_KEY || process.env.TOKENROUTER_API_KEY || process.env.TOKEN || "",
  openaiModel: process.env.OPENAI_MODEL || "gpt-5.5",
  openAlexMailto: process.env.OPENALEX_MAILTO || "",
  host: process.env.HOST || "127.0.0.1",
  openaiBaseUrl: process.env.OPENAI_BASE_URL || ""
};
