require("dotenv").config();
require("@aikidosec/guard").protect({ debug: true });

const express = require("express");
const asyncHandler = require("express-async-handler");
const { MongoClient } = require("mongodb");
const { Posts, Post } = require("./posts");
const { escape } = require("./escape");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");

async function getPosts() {
  // Normally you'd use environment variables for this
  const url = "mongodb://root:password@127.0.0.1:27017";
  const client = new MongoClient(url);
  await client.connect();

  return new Posts(client);
}

async function main() {
  const app = express();
  const posts = await getPosts();

  app.use(morgan("tiny"));
  app.use(cookieParser());

  // Try http://localhost:4000/?search[$ne]=null
  // Which will result in a query like:
  // { title: { '$ne': null } }
  app.get(
    "/",
    asyncHandler(async (req, res) => {
      const homePagePosts = await posts.all(
        req.query.search ? req.query.search : undefined
      );

      res.send(`
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

  return new Promise((resolve, reject) => {
    try {
      app.listen(4000, () => {
        console.log("Listening on port 4000");
        resolve();
      });
    } catch (err) {
      reject(err);
    }
  });
}

main();
