const Zen = require("@aikidosec/firewall");

const Cats = require("./Cats");
const Hapi = require("@hapi/hapi");
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
    CREATE TABLE IF NOT EXISTS cats (
        petname varchar(255)
    );
  `);

  return client;
}

async function init(port) {
  const db = await createConnection();
  const cats = new Cats(db);

  const server = new Hapi.Server({
    port: port,
    host: "127.0.0.1",
  });

  Zen.setupHapiIntegration(server);

  server.route({
    method: "GET",
    path: "/",
    handler: async (request, h) => {
      try {
        if (request.query.petname) {
          await cats.add(request.query.petname);
        }
      } catch (e) {
        return h.response(e.message).code(500);
      }

      return getHTMLBody(await cats.getAll());
    },
  });

  server.route([
    {
      method: "GET",
      path: "/clear",
      handler: async (request, h) => {
        await db.query("DELETE FROM cats;");
        return h.redirect("/");
      },
    },
  ]);

  await server.start();
  console.log(`Server running on http://127.0.0.1:${port}`);
}

function getPort() {
  const port = parseInt(process.argv[2], 10) || 4000;

  if (isNaN(port)) {
    console.error("Invalid port");
    process.exit(1);
  }

  return port;
}

init(getPort());
