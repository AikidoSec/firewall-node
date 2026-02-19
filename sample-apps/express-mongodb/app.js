require("dotenv").config();
const Zen = require("@aikidosec/firewall");

const express = require("express");
const asyncHandler = require("express-async-handler");
const { MongoClient } = require("mongodb");
const { Posts, Post } = require("./posts");
const { escape } = require("./escape");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const { exec } = require("child_process");
const { extname } = require("path");
const fetchImage = require("./fetchImage");

require("@aikidosec/firewall/nopp");

async function getPosts() {
  // Normally you'd use environment variables for this
  const url = "mongodb://root:password@127.0.0.1:27017";
  const client = new MongoClient(url);
  await client.connect();

  return new Posts(client);
}

async function main(port) {
  const app = express();
  const posts = await getPosts();

  app.use(morgan("tiny"));
  app.use(cookieParser());

  app.use("*", (req, res, next) => {
    res.setHeader("X-Frame-Options", "DENY");
    next();
  });

  app.use((req, res, next) => {
    Zen.setUser({ id: "123", name: "John Doe" });
    next();
  });

  Zen.addExpressMiddleware(app);

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

  app.get(
    "/posts/:id",
    asyncHandler(async (req, res) => {
      res.send({ post: { id: req.params.id } });
    })
  );

  app.post(
    "/search",
    express.json(),
    asyncHandler(async (req, res) => {
      // This code is vulnerable to NoSQL injection
      // This is just a sample app to demonstrate the vulnerability
      // Do not use this code in production
      // Always validate and sanitize user input!
      res.send(await posts.search(req.body));
    })
  );

  app.get(
    "/where",
    express.json(),
    asyncHandler(async (req, res) => {
      // This code is vulnerable to JS injection
      // This is just a sample app to demonstrate the vulnerability
      // Do not use this code in production
      // Always validate and sanitize user input!
      const title = req.query.title.toString();
      if (!title) {
        return res.status(400).send("title parameter is required");
      }
      res.send(await posts.where(title));
    })
  );

  app.post("/ls", express.json(), (req, res) => {
    const { directory } = req.body;

    if (!directory) {
      return res.status(400).send("directory parameter is required");
    }

    // Be super careful with this endpoint
    // You can harm your system if you're not careful
    // It's vulnerable to command injection
    // Do not use this code in production
    // Try POST http://localhost:4000/ls with {"directory":"."}
    // Try POST http://localhost:4000/ls with {"directory":"'; ls ~; echo '"}
    // You should use execFile instead of exec
    // or use a library like shell-quote
    exec(`ls '${directory}'`, (error, stdout, stderr) => {
      if (error) {
        throw error;
      }

      res.send(stdout.split("\n"));
    });
  });

  app.get(
    "/images",
    asyncHandler(async (req, res) => {
      // This code is vulnerable to SSRF
      const url = req.query.url;

      if (!url) {
        return res.status(400).send("url parameter is required");
      }

      const response = await fetch(url, {
        method: "GET",
      });

      const buffer = await (await response.blob()).arrayBuffer();

      res.attachment("image.jpg");
      res.send(Buffer.from(buffer));
    })
  );

  app.get(
    "/images/:url",
    asyncHandler(async (req, res) => {
      // This code is vulnerable to SSRF
      const url = req.params.url;

      if (!url) {
        return res.status(400).send("url parameter is required");
      }

      const extension = extname(url) || ".jpg";
      const { statusCode, body } = await fetchImage(url);

      if (statusCode !== 200) {
        return res.status(statusCode).send("Failed to fetch image");
      }

      res.attachment(`image${extension}`);
      res.send(body);
    })
  );

  app.get(
    "/hello/:name",
    asyncHandler(async (req, res) => {
      const { name } = req.params;

      if (!name) {
        return res.status(400).end();
      }

      // This code is vulnerable to code injection
      // This is just a sample app to demonstrate the vulnerability
      // Do not use this code in production
      const welcome = new Function(`return "Hello, your name is ${name}!"`);

      res.send(welcome());
    })
  );

  return new Promise((resolve, reject) => {
    try {
      app.listen(port, () => {
        console.log(`Listening on port ${port}`);
        resolve();
      });
    } catch (err) {
      reject(err);
    }
  });
}

function getPort() {
  const port = parseInt(process.argv[2], 10) || 4000;

  if (isNaN(port)) {
    console.error("Invalid port");
    process.exit(1);
  }

  return port;
}

main(getPort());
