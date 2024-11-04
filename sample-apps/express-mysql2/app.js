require("dotenv").config();
require("@aikidosec/firewall");

const Cats = require("./Cats");
const express = require("express");
const asyncHandler = require("express-async-handler");
const morgan = require("morgan");
const mysql = require("mysql2/promise");

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
  // Normally you'd use environment variables for this
  const connection = await mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "mypassword",
    database: "catsdb",
    port: 27015,
    multipleStatements: true,
  });

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS cats (
        petname varchar(255)
    );
  `);

  return connection;
}

async function main(port) {
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

  app.get(
    "/clear",
    asyncHandler(async (req, res) => {
      await db.execute("DELETE FROM cats;");
      res.redirect("/");
    })
  );

  app.get(
    "/cats/:name",
    asyncHandler(async (req, res) => {
      const found = await cats.byName(req.params.name);

      if (found.length === 0) {
        return res.status(404).send("Cat not found");
      }

      const cat = found[0];

      res.send(`
        <html lang="en">
          <body>
            <h1>${escape(cat)}</h1>
          </body>
        </html>
      `);
    })
  );

  app.listen(port, () => {
    console.log(`Listening on port ${port}`);
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
