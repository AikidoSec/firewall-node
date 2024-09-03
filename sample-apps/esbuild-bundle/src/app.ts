import "@aikidosec/firewall";

import { serve } from "@hono/node-server";
import { Hono } from "hono";
import * as Aikido from "@aikidosec/firewall/context";
import { getDB } from "./db";
import { Cats } from "./Cats";

async function main() {
  const app = new Hono();
  const db = await getDB();
  const cats = new Cats(db);

  app.use(async (c, next) => {
    Aikido.setUser({
      id: "id",
      name: "Name",
    });

    await next();
  });

  app.post("/add", async (c) => {
    const body = await c.req.json();

    if (typeof body.name !== "string") {
      return c.json({ error: "Invalid request" }, 400);
    }

    await cats.add(body.name);
    return c.json({ success: true });
  });

  app.get("/clear", async (c) => {
    try {
      await new Promise((resolve, reject) => {
        db.run("DELETE FROM cats;", (result, err) => {
          if (err) {
            return reject(err);
          }
          resolve(result);
        });
      });
      return c.redirect("/", 302);
    } catch (err) {
      return c.json({ error: "Failed to clear cats" }, 500);
    }
  });

  return app;
}

function getPort() {
  const port = parseInt(process.argv[2], 10) || 4000;

  if (isNaN(port)) {
    console.error("Invalid port");
    process.exit(1);
  }

  return port;
}

main().then((app) => {
  const port = getPort();

  serve({
    fetch: app.fetch,
    port: port,
  }).on("listening", () => {
    console.log(`Server is running on port ${port}`);
  });
});
