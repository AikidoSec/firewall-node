require("@aikidosec/firewall");

const xml2js = require("xml2js");
const { serve } = require("@hono/node-server");
const { Hono } = require("hono");
const { createConnection } = require("./db");
const Aikido = require("@aikidosec/firewall/context");
const Cats = require("./Cats");

async function main() {
  const app = new Hono();
  const db = await createConnection();
  const cats = new Cats(db);

  app.use(async (c, next) => {
    Aikido.setUser({
      id: "id",
      name: "Name",
    });

    await next();
  });

  app.get("/", async (c) => {
    const catNames = await cats.getAll();
    return c.html(
      `
        <html lang="en">
          <body>
            <h1>Vulnerable app using XML</h1>
            <ul id="list">
              ${catNames.map((name) => `<li>${name}</li>`).join("")}
            </ul>
            <form id="add-cat">
              <label for="search">Add a new cat</label>
              <input type="text" name="petname">
              <input type="submit" value="Add" />
            </form>
            <p>SQL Injection: '); DELETE FROM cats;-- H</p>
            <a href="/clear">Clear all cats</a>
            <script>
              document.addEventListener("DOMContentLoaded", () => {
                const form = document.getElementById("add-cat");
                form.addEventListener("submit", async (event) => {
                  event.preventDefault();
                  fetch("/add", {
                    method: "POST",
                    body: "<cat><name>" + form.petname.value + "</name></cat>",
                  }).then(response => response.json())
                    .then(data => {
                      window.location.reload();
                    })
                    .catch(error => document.getElementById("list").innerHTML = "<li>Error</li>");
                  window.location.reload();
                });
              });
            </script>
          </body>
        </html>
      `
    );
  });

  app.post("/add", async (c) => {
    const body = await c.req.text();

    let result;
    try {
      const parser = new xml2js.Parser();
      result = await parser.parseStringPromise(body);
    } catch (err) {
      return c.json({ error: "Invalid XML" }, 400);
    }

    await cats.add(result.cat.name[0]);

    return c.json({ success: true });
  });

  app.post("/add-attribute", async (c) => {
    const body = await c.req.text();

    let result;
    try {
      const parser = new xml2js.Parser();
      result = await parser.parseStringPromise(body);
    } catch (err) {
      return c.json({ error: "Invalid XML" }, 400);
    }

    await cats.add(result.cat.$.name);

    return c.json({ success: true });
  });

  app.get("/clear", async (c) => {
    await db.execute("DELETE FROM cats;");
    return c.redirect("/");
  });

  return app;
}

function getPort() {
  const port = parseInt(process.argv[2], 10) || 4000;

  if (isNaN(port)) {
    console.error("Invalid port");
    process.exit(1);
  }

  return port;
}

main().then((app) => {
  const port = getPort();

  serve({
    fetch: app.fetch,
    port: port,
  }).on("listening", () => {
    console.log(`Server is running on port ${port}`);
  });
});
