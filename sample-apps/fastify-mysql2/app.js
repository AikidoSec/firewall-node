// Import Aikido Firewall

require("@aikidosec/firewall");
const { createConnection } = require("./db");
const { getContext } = require("@aikidosec/firewall/agent/context");

const fastify = require("fastify");
const Cats = require("./Cats");

// Prevent Prototype Pollution
require("@aikidosec/firewall/nopp");

/**
 * Get the HTML body of the root page
 */
function getHTMLBody(cats) {
  return `
  <html lang="en">
    <bod>
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

// Async main function that starts the Fastify server
(async () => {
  const db = await createConnection();
  const cats = new Cats(db);

  const app = fastify({
    logger: true,
  });

  // Handle GET requests to the root URL
  app.get("/", async (request, reply) => {
    if (request.query["petname"]) {
      await cats.add(request.query["petname"]);
    }
    const html = getHTMLBody(await cats.getAll());
    reply.header("Content-Type", "text/html").send(html);
  });

  app.get("/context", async (request, reply) => {
    const context = getContext();
    reply.send(context);
  });

  app.route({
    method: "GET",
    url: "/cats",
    handler: async (request, reply) => {
      reply.send(await cats.getAll());
    },
  });

  // Handle GET requests to /clear
  app.get("/clear", async (request, reply) => {
    await db.execute("DELETE FROM cats;");
    reply.redirect("/");
  });

  // Start the server
  try {
    await app.listen({ port: getPort() });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
})();

function getPort() {
  const port = parseInt(process.argv[2], 10) || 4000;

  if (isNaN(port)) {
    console.error("Invalid port");
    process.exit(1);
  }

  return port;
}
