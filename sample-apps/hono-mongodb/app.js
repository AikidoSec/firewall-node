require("@aikidosec/firewall");

const { serve } = require("@hono/node-server");
const { Hono } = require("hono");
const { MongoClient } = require("mongodb");
const { Post, Posts } = require("./posts");
const { escape } = require("./escape");
const Zen = require("@aikidosec/firewall");

async function getPosts() {
  // Normally you'd use environment variables for this
  const url = "mongodb://root:password@127.0.0.1:27017";
  const client = new MongoClient(url);
  await client.connect();

  return new Posts(client);
}

async function main() {
  const posts = await getPosts();
  const app = new Hono();

  app.use(async (c, next) => {
    Zen.setUser({
      id: "id",
      name: "Name",
    });

    await next();
  });

  Zen.addHonoMiddleware(app);

  app.use("/posts/*", async (c, next) => {
    await next();
  });

  app.get("/", async (c) => {
    const query = c.req.query();
    const homePagePosts = await posts.all(
      query.search ? query.search : undefined
    );

    return c.html(
      `
        <html lang="en">
          <body>
            <form action="/" method="GET">
              <label for="search">Search</label>
              <input type="text" name="search">
              <input type="submit" value="Search" />
            </form>
            <ul>
              ${homePagePosts.map((post) => `<li>${escape(post.getTitle())}</li>`).join("\n")}
            </ul>
            <form action="/posts" method="POST">
              <label for="title">Title</label>
              <input type="text" name="title" />
              <input type="submit" value="Create post" />
            </form>
          </body>
        </html>
      `
    );
  });

  app.post("/posts", async (c) => {
    const body = await c.req.parseBody();
    const post = new Post(body.title, new Date());
    await posts.persist(post);

    return c.redirect("/");
  });

  app.post("/search", async (c) => {
    const body = await c.req.json();
    const homePagePosts = await posts.all(body.title);

    return c.json(homePagePosts);
  });

  app.get(
    "/posts/:id",
    async (c, next) => {
      await next();
    },
    (c) => {
      const { id } = c.req.param();

      return c.text(`Post ${id}`);
    }
  );

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
