const express = require("express");
const config = require("./src/handlers/getConfig");
const captureEvent = require("./src/handlers/captureEvent");
const listEvents = require("./src/handlers/listEvents");
const createApp = require("./src/handlers/createApp");
const checkToken = require("./src/middleware/checkToken");

const app = express();

const port = process.env.PORT || 3000;

app.use(express.json());

app.get("/api/runtime/config", checkToken, config);
app.post("/api/runtime/events", checkToken, captureEvent);

app.get("/api/runtime/events", checkToken, listEvents);
app.post("/api/runtime/apps", createApp);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
