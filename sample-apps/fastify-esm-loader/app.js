import Zen from "@aikidosec/firewall";
import Fastify, { fastify } from "fastify";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const app = Fastify();
const namedApp = fastify();
await namedApp.close();

Zen.addFastifyHook(app);

app.post("/file", (request) => {
  return readFileSync(
    join(import.meta.dirname, "files", request.body.path || "test.txt"),
    "utf8"
  );
});

await app.listen({ port: Number(process.argv[2] ?? 4000), host: "0.0.0.0" });
const { port } = app.server.address();
console.log(`Listening on port ${port}`);
process.send?.({ port });
