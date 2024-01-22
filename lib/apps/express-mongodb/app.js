// Normally this would be require("aikido").start();
const { start, middleware } = require("../../../dist");
start();

const express = require("express");
const asyncHandler = require("express-async-handler");
const app = express();
const { MongoClient } = require("mongodb");
const { Posts, Post } = require("./posts");
const { escape } = require("./escape");
const morgan = require("morgan");
const url = "mongodb://root:password@127.0.0.1:27017";
const client = new MongoClient(url);
const posts = new Posts(client);

app.use(middleware);
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

async function main() {
  await client.connect();
  app.listen(3000, () => {
    console.log("Server is running on port 3000");
  });
}

main();
