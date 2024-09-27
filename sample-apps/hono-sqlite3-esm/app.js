import { Hono } from "hono";
import { serve } from "@hono/node-server";

const app = new Hono();

app.get("/", (ctx) => {
  return ctx.text("Hello, World!");
});

function getPort() {
  const port = parseInt(process.argv[2], 10) || 4000;

  if (isNaN(port)) {
    console.error("Invalid port");
    process.exit(1);
  }

  return port;
}

const port = getPort();
serve({
  fetch: app.fetch,
  port: port,
}).on("listening", () => {
  console.log(`Server is running on port ${port}`);
});
