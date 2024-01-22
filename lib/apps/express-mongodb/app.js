// Normally this would be require("aikido");
require("../../../dist");

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

  app.use(morgan("tiny"));

  app.get(
    "/",
    asyncHandler(async (req, res) => {
      const homePagePosts = await posts.all();

      res.send(`
        <html>
          <body>
            <ul>
              ${homePagePosts.map((post) => `<li>${escape(post.getTitle())}</li>`).join("\n")}
            </ul>
            <form action="/" method="POST">
              <input type="text" name="title" />
              <input type="submit" value="Submit" />
            </form>
          </body>
        </html>
      `);
    })
  );

  app.post(
    "/",
    express.urlencoded({ extended: false }),
    asyncHandler(async (req, res) => {
      const post = new Post(req.body.title, new Date());
      await posts.persist(post);
      res.redirect("/");
    })
  );

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
