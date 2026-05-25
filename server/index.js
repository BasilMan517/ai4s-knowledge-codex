import { createApp } from "./app.js";
import { config } from "./config.js";
import { ensureStorage } from "./storage.js";

await ensureStorage();

const app = createApp({ serveStatic: true });

app.listen(config.port, config.host, () => {
  console.log(`AI4S Knowledge Codex server listening on http://${config.host}:${config.port}`);
});
