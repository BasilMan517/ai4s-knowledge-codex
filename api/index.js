import { createApp } from "../server/app.js";
import { ensureStorage } from "../server/storage.js";

await ensureStorage();

export default createApp();
