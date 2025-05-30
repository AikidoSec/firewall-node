const Zen = require("@aikidosec/firewall");
const {
  createApp,
  createRouter,
  defineEventHandler,
  getQuery,
  sendRedirect,
  toNodeListener,
} = require("h3");
const { Client } = require("pg");

const Cats = require("./Cats");
const { createServer } = require("http");

require("@aikidosec/firewall/nopp");

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
    CREATE TABLE IF NOT EXISTS cats_3 (
        petname varchar(255),
        comment varchar(255)
    );
  `);

  return client;
}

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
    <a href="/?petname=Kitty'); DELETE FROM cats;-- H">Test injection</a> / <a href="/clear">Clear table</a>
  </body>
</html>`;
}

(async () => {
  const db = await createConnection();
  const cats = new Cats(db);

  // Create an app instance
  const app = createApp();

  Zen.addH3Middleware(app);

  // Create a new router and register it in app
  const router = createRouter();

  // Add a new route that matches GET requests to / path
  router.get(
    "/",
    defineEventHandler(async (event) => {
      const query = getQuery(event);

      if (typeof query["petname"] === "string") {
        await cats.add(query["petname"]);
      }

      return getHTMLBody(await cats.getAll());
    })
  );

  router.get(
    "/clear",
    defineEventHandler(async (event) => {
      await cats.clear();
      return sendRedirect(event, "/");
    })
  );

  app.use(router);

  createServer(toNodeListener(app)).listen(process.env.PORT || 3000, () => {
    console.log(`Listening on port ${process.env.PORT || 3000}`);
  });
})();
