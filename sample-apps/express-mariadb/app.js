require("dotenv").config();
require("@aikidosec/zen");

const Cats = require("./Cats");
const express = require("express");
const asyncHandler = require("express-async-handler");
const morgan = require("morgan");
const mariadb = require("mariadb");

require("@aikidosec/zen/nopp");

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
    <a href="http://localhost:4000/?petname=Kitty'); DELETE FROM cats;-- H">Test injection</a>
  </body>
</html>`;
}

async function createConnection() {
  const pool = new mariadb.createPool({
    user: "root",
    host: "127.0.0.1",
    database: "catsdb",
    password: "mypassword",
    port: 27015,
    multipleStatements: true,
  });

  const conn = await pool.getConnection();
  await conn.query(`
    CREATE TABLE IF NOT EXISTS cats (
        petname varchar(255)
    );
  `);
  conn.end();

  return pool;
}

async function main() {
  const db = await createConnection();
  const cats = new Cats(db);

  const app = express();

  app.use(morgan("tiny"));

  app.get(
    "/",
    asyncHandler(async (req, res) => {
      if (req.query["petname"]) {
        await cats.add(req.query["petname"]);
      }

      res.send(getHTMLBody(await cats.getAll()));
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
