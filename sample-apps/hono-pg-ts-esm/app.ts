import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { createConnection } from "./db.ts";
import type { Client } from "pg";

const app = new Hono();
const db: Client = await createConnection();

app.get("/", async (c) => {
  return c.text("Hello, World!");
});

interface AddRequest {
  name: string;
}

app.post("/add", async (c) => {
  const json: AddRequest = await c.req.json();
  const name: string = json.name;
  if (!name) {
    return c.status(400).text("Name is required");
  }

  // Insecure
  await db.query(`INSERT INTO cats_3 (petname) VALUES ('${name}');`);
  return c.text("OK");
});

app.get("/clear", async (c) => {
  await db.query("DELETE FROM cats_3;");
  return c.text("Table cleared");
});

function getPort(): number {
  const port: number = parseInt(process.argv[2], 10) || 4000;

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
