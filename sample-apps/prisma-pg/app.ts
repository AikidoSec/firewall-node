import Zen from "@aikidosec/firewall";

process.env.DATABASE_URL = "postgres://root:password@127.0.0.1:27016/main_db_2";

import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { prisma } from "./lib/prisma";

function getPort() {
  const port = parseInt(process.argv[2], 10) || 4000;

  if (isNaN(port)) {
    console.error("Invalid port");
    process.exit(1);
  }

  return port;
}

async function main() {
  const port = getPort();

  const app = new Hono();

  Zen.addHonoMiddleware(app);

  app.get("/", async (c) => {
    return c.text("Hello, world!");
  });

  app.get("/posts/:title", async (c) => {
    // Insecure, do not use in production
    const posts = await prisma.$queryRawUnsafe(
      `SELECT * FROM "Post" WHERE title = '${c.req.param().title}'`
    );
    return c.json(posts);
  });

  serve({
    fetch: app.fetch,
    port: port,
  }).on("listening", () => {
    console.log(`Server is running on port ${port}`);
  });
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
