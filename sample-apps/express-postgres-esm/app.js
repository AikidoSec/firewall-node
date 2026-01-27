import Zen from "@aikidosec/firewall";

import Cats from "./Cats.js";
import express from "express";
import asyncHandler from "express-async-handler";
import { Client } from "pg";

import "@aikidosec/firewall/nopp";

function getHTMLBody(cats) {
  return `
<html lang="en">
  <body>
    <p>All cats : ${cats.join(", ")}</p>
    <form action="/" method="GET">
      <label for="search">Add a new cat</label>
      <input type="text" name="petname">
      <input type="submit" value="Add" />
    </form>
    <a href="http://localhost:4000/?petname=Kitty'); DELETE FROM cats_4;-- H">Test injection</a> / <a href="http://localhost:4000/clear">Clear table</a>
  </body>
</html>`;
}

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
    CREATE TABLE IF NOT EXISTS cats_4 (
        petname varchar(255),
        comment varchar(255)
    );
  `);

  return client;
}

const db = await createConnection();
const cats = new Cats(db);

const app = express();

Zen.addExpressMiddleware(app);

app.use(express.json());

app.use("/auth", (req, res, next) => {
  if (req.headers["x-api-key"] !== "123456") {
    res.status(403).send("Forbidden");
    return;
  }
  next();
});

app.get(
  "/",
  asyncHandler(async (req, res) => {
    if (req.query["petname"]) {
      await cats.add(req.query["petname"]);
    }

    res.send(getHTMLBody(await cats.getAll()));
  })
);

app.get(
  "/clear",
  asyncHandler(async (req, res) => {
    db.query("DELETE FROM cats_4;", function afterClear(err) {
      if (err) {
        res.status(500).send("Error clearing table");
        return;
      }

      res.redirect("/");
    });
  })
);

const port = getPort();

app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});

function getPort() {
  const port = parseInt(process.argv[2], 10) || 4000;

  if (isNaN(port)) {
    console.error("Invalid port");
    process.exit(1);
  }

  return port;
}
