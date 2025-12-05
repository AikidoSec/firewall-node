// This is an insecure mock server for testing purposes

import express from "express";
import { getConfig } from "./src/handlers/getConfig.ts";
import { captureEvent } from "./src/handlers/captureEvent.ts";
import { listEvents } from "./src/handlers/listEvents.ts";
import { createApp } from "./src/handlers/createApp.ts";
import { checkToken } from "./src/middleware/checkToken.ts";
import { updateConfig } from "./src/handlers/updateConfig.ts";
import { lists } from "./src/handlers/lists.ts";
import { updateIPLists } from "./src/handlers/updateLists.ts";
import { realtimeConfig } from "./src/handlers/realtimeConfig.ts";

const app = express();
app.set("trust proxy", false);
app.set("x-powered-by", false);

const port = process.env.PORT || 3000;

app.use(express.json());

app.get("/api/runtime/config", checkToken, getConfig);
app.post("/api/runtime/config", checkToken, updateConfig);

// Realtime polling endpoint
app.get("/config", checkToken, realtimeConfig);

app.get("/api/runtime/events", checkToken, listEvents);
app.post("/api/runtime/events", checkToken, captureEvent);

app.get("/api/runtime/firewall/lists", checkToken, lists);
app.post("/api/runtime/firewall/lists", checkToken, updateIPLists);

app.post("/api/runtime/apps", createApp);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
