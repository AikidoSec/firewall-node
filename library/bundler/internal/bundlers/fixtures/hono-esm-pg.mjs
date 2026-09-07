import Zen from "@aikidosec/firewall";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { Client } from "pg";

const db = new Client({
  connectionString: process.env.DATABASE_URL,
});
db.connect();

const app = new Hono();

app.use(async (c, next) => {
  Zen.setUser({
    id: "id",
    name: "Name",
  });

  await next();
});

app.get("/", (c) => {
  db.query("SELECT 1");
  return c.text("Hello world!");
});

const port = process.env.PORT || 3000;
serve({
  fetch: app.fetch,
  port,
}).on("listening", () => {
  // oxlint-disable-next-line no-console
  console.info(`Server is running on port ${port}`);
});
