import { createServer } from "node:http";
import { shutdown } from "../../../build/index.js";

const server = createServer((req, res) => {
  res.writeHead(201, { "X-App-Handler": "fixture" });
  res.end("App fixture");
});

process.once("message", () => shutdown());
server.listen(0, "127.0.0.1", () => process.send(server.address().port));
