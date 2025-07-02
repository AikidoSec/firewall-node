require("dotenv").config();
require("@aikidosec/firewall");

const Cats = require("./Cats");
const restify = require("restify");
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
    <a href="http://localhost:4000/?petname=Kitty'); DELETE FROM cats_2;-- H">Test injection</a> / <a href="http://localhost:4000/clear">Clear table</a>
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

  const server = restify.createServer({
    name: "restify-postgres-sample",
    version: "1.0.0",
  });

  // Use restify plugins
  server.use(restify.plugins.acceptParser(server.acceptable));
  server.use(restify.plugins.queryParser());
  server.use(restify.plugins.bodyParser());
  server.use(restify.plugins.gzipResponse());

  server.get("/", (req, res, next) => {
    let promise = Promise.resolve();

    if (req.query["petname"]) {
      promise = cats.add(req.query["petname"]);
    }

    promise
      .then(() => {
        return cats.getAll();
      })
      .then((allCats) => {
        res.writeHead(200, {
          "Content-Type": "text/html",
        });
        res.end(getHTMLBody(allCats));
        return next();
      })
      .catch((err) => {
        res.send(500, err.message);
        return next();
      });
  });

  server.post("/string-concat", (req, res, next) => {
    if (!req.body.petname) {
      res.send(400, "Missing petname");
      return next();
    }

    db.query(
      `INSERT INTO cats_2 (petname, comment) VALUES ('${req.body.petname}');`
    )
      .then(() => {
        return cats.getAll();
      })
      .then((allCats) => {
        res.send(allCats);
        return next();
      })
      .catch((err) => {
        res.send(500, err.message);
        return next();
      });
  });

  server.get("/string-concat", (req, res, next) => {
    if (!req.query.petname) {
      res.send(400, "Missing petname");
      return next();
    }

    db.query(
      `INSERT INTO cats_2 (petname, comment) VALUES ('${req.query.petname}');`
    )
      .then(() => {
        return cats.getAll();
      })
      .then((allCats) => {
        res.send(allCats);
        return next();
      })
      .catch((err) => {
        res.send(500, err.message);
        return next();
      });
  });

  server.get("/clear", (req, res, next) => {
    db.query("DELETE FROM cats_2;")
      .then(() => {
        res.header("Location", "/");
        res.send(302);
        return next();
      })
      .catch((err) => {
        res.send(500, "Error clearing table");
        return next();
      });
  });

  return new Promise((resolve, reject) => {
    try {
      server.listen(port, () => {
        console.log(`${server.name} listening at ${server.url}`);
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
