require("dotenv").config();
const { protect, preventPrototypePollution } = require("@aikidosec/guard");

protect({ debug: true });

const Cats = require("./Cats");
const express = require("express");
const asyncHandler = require("express-async-handler");
const morgan = require("morgan");
const mysql = require("mysql2");

preventPrototypePollution();

function getHTMLBody(cats) {
  return `
<html lang="en">
  <body>
    <p>All cats : ${cats.join(", ")}</p>
    <form action="/" method="post">
      <input type="text" name="petname">
      <p>Try this: Kitty'); DELETE FROM cats;--</p>
      <input type="submit" value="Add" />
    </form>
  </body>
</html>`;
}

async function getDBClient() {
  // You would normally use environment variables for this
  const db = await mysql.createPool({
    host: "localhost",
    user: "root",
    password: "mypassword",
    database: "catsdb",
    port: 27015,
  });

  const promiseDb = db.promise();
  const conn = await promiseDb.getConnection();
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS cats (
        petname varchar(255)
    );
    `);
  promiseDb.releaseConnection(conn);

  return promiseDb;
}

async function main() {
  const db = await getDBClient();
  const cats = new Cats(db);

  const app = express();

  app.use(morgan("tiny"));

  app.get(
    "/",
    asyncHandler(async (req, res) => {
      res.send(getHTMLBody(await cats.all()));
    })
  );

  app.post(
    "/",
    express.urlencoded({ extended: false }),
    asyncHandler(async (req, res) => {
      if (!req.body.petname) {
        res.status(400).send();
        return;
      }

      await cats.add(req.body.petname);

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
