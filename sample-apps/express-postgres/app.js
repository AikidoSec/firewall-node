require("dotenv").config();
require("@aikidosec/firewall");

const Cats = require("./Cats");
const express = require("express");
const asyncHandler = require("express-async-handler");
const morgan = require("morgan");
const { Client } = require("pg");

require("@aikidosec/firewall/nopp");

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
    <a href="http://localhost:4000/?petname=Kitty'); DELETE FROM cats;-- H">Test injection</a> / <a href="http://localhost:4000/clear">Clear table</a>
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
    CREATE TABLE IF NOT EXISTS cats_2 (
        petname varchar(255),
        comment varchar(255)
    );
  `);

  return client;
}

async function main(port) {
  const db = await createConnection();
  const cats = new Cats(db);

  const app = express();

  app.use(morgan("tiny"));
  app.use(express.json());

  app.get(
    "/",
    asyncHandler(async (req, res) => {
      if (req.query["petname"]) {
        await cats.add(req.query["petname"]);
      }

      res.send(getHTMLBody(await cats.getAll()));
    })
  );

  app.post(
    "/string-concat",
    asyncHandler(async (req, res) => {
      if (!req.body.petname) {
        return res.status(400).send("Missing petname");
      }
      await db.query(
        `INSERT INTO cats_2 (petname, comment) VALUES ('${req.body.petname}');`
      );
      res.send(await cats.getAll());
    })
  );

  app.get(
    "/string-concat",
    asyncHandler(async (req, res) => {
      if (!req.query.petname) {
        return res.status(400).send("Missing petname");
      }
      await db.query(
        `INSERT INTO cats_2 (petname, comment) VALUES ('${req.query.petname}');`
      );
      res.send(await cats.getAll());
    })
  );

  app.get(
    "/clear",
    asyncHandler(async (req, res) => {
      db.query("DELETE FROM cats_2;", function afterClear(err) {
        if (err) {
          res.status(500).send("Error clearing table");
          return;
        }

        res.redirect("/");
      });
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
