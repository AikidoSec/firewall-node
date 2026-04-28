import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { createConnection } from "./db.js";
import { setToken } from "@aikidosec/firewall";

const app = new Hono();
const db = await createConnection();

app.get("/", async (c) => {
  return c.text("Hello, World!");
});

app.post("/add", async (c) => {
  const json = await c.req.json();
  const name = json.name;
  if (!name) {
    return c.status(400).text("Name is required");
  }

  await db.query(
    `INSERT INTO cats_6 (petname, user_id) VALUES ('${name}', 1);`
  );
  return c.text("OK");
});

function getPort() {
  const port = parseInt(process.argv[2], 10) || 4000;

  if (isNaN(port)) {
    console.error("Invalid port");
    process.exit(1);
  }

  return port;
}

// Set the token after startup (simulates fetching from a secrets manager)
setTimeout(() => {
  setToken(process.env.AIKIDO_TOKEN);
}, 500);

serve(
  {
    fetch: app.fetch,
    port: getPort(),
  },
  (info) => {
    console.log(`Server is running on http://${info.address}:${info.port}`);
  }
);
