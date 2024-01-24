require("aikido-rasp");

const Sentry = require("@sentry/node");
Sentry.init({
  dsn: "https://e23dd06d7bff44f18d86f33878e67891@019635.ingest.sentry.io/6173453",
  maxBreadcrumbs: 50,
  debug: true,
  tracesSampleRate: 1,
  integrations: [new Sentry.Integrations.Mongo({})],
  beforeSendTransaction: (transaction) => {
    console.log(JSON.stringify(transaction.contexts, null, 2));

    return transaction;
  },
});

const express = require("express");
const asyncHandler = require("express-async-handler");
const { MongoClient } = require("mongodb");
const { Posts, Post } = require("./posts");
const { escape } = require("./escape");
const morgan = require("morgan");

async function getPosts() {
  const url = "mongodb://root:password@127.0.0.1:27017";
  const client = new MongoClient(url);
  await client.connect();

  return new Posts(client);
}

async function main() {
  const app = express();
  const posts = await getPosts();

  app.use(Sentry.Handlers.requestHandler());
  app.use(Sentry.Handlers.tracingHandler());
  app.use(morgan("tiny"));

  // Try http://localhost:3000/?search[$ne]=null
  // Which will result in a query like:
  // { title: { '$ne': null } }
  app.get(
    "/",
    asyncHandler(async (req, res) => {
      const homePagePosts = await posts.all(
        req.query.search ? req.query.search : undefined
      );

      res.send(`
        <html>
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
      `);
    })
  );

  app.post(
    "/posts",
    express.urlencoded({ extended: false }),
    asyncHandler(async (req, res) => {
      const post = new Post(req.body.title, new Date());
      await posts.persist(post);
      res.redirect("/");
    })
  );

  app.use(Sentry.Handlers.errorHandler());

  return new Promise((resolve, reject) => {
    try {
      app.listen(3000, () => {
        console.log("Listening on port 3000");
        resolve();
      });
    } catch (err) {
      reject(err);
    }
  });
}

main();
