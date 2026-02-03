import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { readFile } from "fs/promises";
import { join } from "path";
import { createConnection } from "./db.js";
import Zen from "@aikidosec/firewall";

Zen.enableIdorProtection({
  tenantColumnName: "user_id",
  excludedTables: ["cats_3"],
});

const app = new Hono();
const db = await createConnection();

app.use(async (c, next) => {
  const userId = c.req.header("x-user-id") || 1;

  // Allows IDOR test, because SQL queries always use user ID 1
  c.set("userId", 1);

  Zen.setUser({ id: userId });
  Zen.setTenantId(userId);

  await next();
});

Zen.addHonoMiddleware(app);

app.get("/", async (c) => {
  return c.text("Hello, World!");
});

app.get("/file", async (c) => {
  const path = c.req.query("path");
  const data = await readFile(
    join(import.meta.dirname, "files", path || "test.txt"),
    "utf8"
  );
  return c.text(data);
});

app.post("/add", async (c) => {
  const json = await c.req.json();
  const name = json.name;
  if (!name) {
    return c.status(400).text("Name is required");
  }

  const table =
    json.withIdorProtection === true ? "cats_3_with_idor" : "cats_3";

  // Insecure
  await db.query(
    `INSERT INTO ${table} (petname, user_id) VALUES ('${name}', ${c.get("userId")});`
  );
  return c.text("OK");
});

app.get("/clear", async (c) => {
  await db.query(`DELETE FROM cats_3 WHERE user_id = ${c.get("userId")};`);
  return c.text("Table cleared");
});

app.get("/fetch", async (c) => {
  const url = c.req.query("url");
  if (!url) {
    return c.json({ error: "url query param is required" }, 400);
  }
  const response = await fetch(url);
  const text = await response.text();
  return c.json({ success: true, status: response.status, body: text });
});

function getPort() {
  const port = parseInt(process.argv[2], 10) || 4000;

  if (isNaN(port)) {
    console.error("Invalid port");
    process.exit(1);
  }

  return port;
}

serve(
  {
    fetch: app.fetch,
    port: getPort(),
  },
  (info) => {
    console.log(`Server is running on http://${info.address}:${info.port}`);
  }
);
