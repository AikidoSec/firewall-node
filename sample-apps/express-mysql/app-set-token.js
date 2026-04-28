const Zen = require("@aikidosec/firewall");

Zen.prepare();

const Cats = require("./Cats");
const express = require("express");
const asyncHandler = require("express-async-handler");
const mysql = require("mysql");

async function createConnection() {
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

  app.get(
    "/",
    asyncHandler(async (req, res) => {
      if (req.query["petname"]) {
        await cats.add(req.query["petname"]);
      }

      res.send(`All cats: ${(await cats.getAll()).join(", ")}`);
    })
  );

  // Set the token after startup (simulates fetching from a secrets manager)
  setTimeout(() => {
    Zen.setToken(process.env.AIKIDO_TOKEN);
  }, 500);

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
