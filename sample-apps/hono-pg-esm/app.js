import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { readFile } from "fs/promises";
import fs from "fs/promises";
import { join } from "path";
import { createConnection } from "./db.js";

const app = new Hono();
const db = await createConnection();

// Check until we have ESM unit tests
if (!readFile.__wrapped || !fs.readFile.__wrapped) {
  console.error("fs.readFile is not wrapped");
  process.exit(1);
}

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

app.get("/clear", async (c) => {
  await db.query("DELETE FROM cats_3;");
  return c.text("Table cleared");
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
