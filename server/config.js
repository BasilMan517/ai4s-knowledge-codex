import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: Number(process.env.PORT || 8787),
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  openaiModel: process.env.OPENAI_MODEL || "gpt-5.3-codex",
  openAlexMailto: process.env.OPENALEX_MAILTO || "",
  host: process.env.HOST || "127.0.0.1"
};
