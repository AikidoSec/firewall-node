const { serve } = require("@hono/node-server");
const { Hono } = require("hono");
const { Client } = require("pg");
const { Posts } = require("./posts");

async function createConnection() {
  const client = new Client({
    user: "root",
    host: "127.0.0.1",
    database: "main_db",
    password: "password",
    port: 27016,
  });

  await client.connect();
  await client.query(`
    CREATE TABLE IF NOT EXISTS posts (
        title varchar(255),
        text text
    );
  `);

  //Clear the table
  await client.query(`DELETE FROM posts`);

  return client;
}

async function main() {
  const app = new Hono();
  const db = await createConnection();
  const posts = new Posts(db);

  app.get("/api/posts", async (c) => {
    return c.json(await posts.getAll());
  });

  app.post("/api/posts", async (c) => {
    const body = await c.req.json();
    await posts.add(body.title, body.text);

    return c.json({ success: true });
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
