require("dotenv").config();
require("@aikidosec/firewall");

const Cats = require("./Cats");
const express = require("express");
const asyncHandler = require("express-async-handler");
const morgan = require("morgan");
const mariadb = require("mariadb");

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
    <a href="http://localhost:4000/?petname=Kitty'); DELETE FROM cats;-- H">Test injection</a>
  </body>
</html>`;
}

async function createConnection() {
  const pool = new mariadb.createPool({
    host: "localhost",
    user: "root",
    password: "mypassword",
    database: "catsdb",
    port: 27018,
    connectionLimit: 5,
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
      const port = getPort();
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

main();
