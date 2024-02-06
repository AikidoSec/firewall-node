require("dotenv").config();
require("@aikidosec/guard").protect({ debug: true });

const mongoose = require("mongoose");
const express = require("express");
const asyncHandler = require("express-async-handler");
const { Cat } = require("./Cat");
const { escape } = require("./escape");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");

async function main() {
  const app = express();
  // Normally you'd use environment variables for this
  await mongoose.connect("mongodb://root:password@127.0.0.1:27017");

  app.use(morgan("tiny"));
  app.use(cookieParser());

  // Try http://localhost:4000/?search[$ne]=null
  // Which will result in a query like:
  // { title: { '$ne': null } }
  app.get(
    "/",
    asyncHandler(async (req, res) => {
      const cats = await Cat.find(
        req.query.search ? { name: req.query.search } : {}
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
              ${cats.map((cat) => `<li>${escape(cat.name)}</li>`).join("\n")}
            </ul>
            <form action="/cats" method="POST">
              <label for="name">Name</label>
              <input type="text" name="name" />
              <input type="submit" value="Create cat" />
            </form>
          </body>
        </html>
      `);
    })
  );

  app.post(
    "/cats",
    express.urlencoded({ extended: false }),
    asyncHandler(async (req, res) => {
      const cat = new Cat({
        name: req.body.name,
        createdAt: new Date(),
      });

      await cat.save();
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
