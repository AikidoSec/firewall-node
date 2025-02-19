require("dotenv").config();
const Zen = require("@aikidosec/firewall");
const Sentry = require("@sentry/node");

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  debug: true,
  tracesSampleRate: 0,
});

const Cats = require("./Cats");
const express = require("express");
const asyncHandler = require("express-async-handler");
const morgan = require("morgan");
const mysql = require("mysql");
const { xml2js } = require("xml-js");
const { escape } = require("./escape");

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
  // Normally you'd use environment variables for this
  const connection = await mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "mypassword",
    database: "catsdb",
    port: 27015,
    multipleStatements: true,
  });

  await connection.query(`
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

  Zen.addExpressMiddlewareAsync(app);

  app.use(Sentry.Handlers.requestHandler());
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

  app.post(
    "/cats",
    express.text({ type: "application/xml" }),
    asyncHandler(async (req, res) => {
      const input = xml2js(req.body, { compact: true });

      if (!input || !input.cat || !input.cat.name || !input.cat.name._text) {
        return res
          .status(400)
          .send(
            `Invalid XML. Expected ${escape("<cat><name>...</name></cat>")}`
          );
      }

      await cats.add(input.cat.name._text);

      res.redirect("/");
    })
  );

  app.use(Sentry.Handlers.errorHandler());

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
