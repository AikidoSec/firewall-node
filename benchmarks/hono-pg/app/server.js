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
        id serial PRIMARY KEY,
        title varchar(255),
        text text
    );
    CREATE TABLE IF NOT EXISTS authors (
        id serial PRIMARY KEY,
        name varchar(255)
    );
    CREATE TABLE IF NOT EXISTS post_authors (
        post_id integer,
        author_id integer,
        FOREIGN KEY (post_id) REFERENCES posts (id),
        FOREIGN KEY (author_id) REFERENCES authors (id)
    );
  `);

  //Clear the db tables
  await client.query(`DELETE FROM post_authors`);
  await client.query(`DELETE FROM posts`);
  await client.query(`DELETE FROM authors`);

  return client;
}

async function main() {
  const app = new Hono();
  const db = await createConnection();
  const posts = new Posts(db);

  app.get("/api/posts", async (c) => {
    const result = await posts.getAll();

    return c.json(result);
  });

  app.post("/api/posts", async (c) => {
    const body = await c.req.json();

    if (!body.title || !body.text) {
      return c.json(
        { success: false, error: "Title and text are required" },
        400
      );
    }

    if (!Array.isArray(body.authors)) {
      return c.json({ success: false, error: "Authors must be an array" }, 400);
    }

    await posts.add(body.title, body.text, body.authors);

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
