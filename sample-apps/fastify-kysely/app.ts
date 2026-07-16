import Zen from "@aikidosec/firewall";
import { fastify } from "fastify";
import { db } from "./db.ts";
import { sql } from "kysely";

const app = fastify({
  logger: true,
});

Zen.addFastifyHook(app);

/**
 * Get the HTML body of the root page
 */
function getHTMLBody(cats: string[]) {
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

// Handle GET requests to the root URL
app.get<{ Querystring: { petname?: string } }>("/", async (request, reply) => {
  if (request.query["petname"]) {
    await sql`INSERT INTO "catsKysely" (name) VALUES ('${sql.raw(request.query["petname"])}')`.execute(
      db
    );
  }
  const html = getHTMLBody(
    await db
      .selectFrom("catsKysely")
      .selectAll()
      .execute()
      .then((rows) => rows.map((row) => row.name))
  );
  reply.header("Content-Type", "text/html").send(html);
});

// Handle GET requests to /clear
app.get("/clear", async (request, reply) => {
  await db.deleteFrom("catsKysely").execute();
  reply.redirect("/");
});

// Start the server
try {
  await app.listen({ port: getPort() });
  console.info(`Server is running at http://localhost:${getPort()}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

function getPort() {
  const port = parseInt(process.argv[2], 10) || 4000;

  if (isNaN(port)) {
    console.error("Invalid port");
    process.exit(1);
  }

  return port;
}
