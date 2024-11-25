const Zen = require("@aikidosec/firewall");

const { PrismaClient } = require("@prisma/client");
const { serve } = require("@hono/node-server");
const { Hono } = require("hono");

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

  const prisma = new PrismaClient();

  const app = new Hono();

  app.get("/", async (c) => {
    return c.text("Hello, world!");
  });

  app.get("/posts/:title", async (c) => {
    // Insecure, do not use in production
    const posts = await prisma.$queryRawUnsafe(
      'SELECT * FROM Post WHERE `title` = "' + c.req.param().title + '"'
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
