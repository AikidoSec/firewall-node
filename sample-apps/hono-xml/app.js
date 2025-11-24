const Zen = require("@aikidosec/firewall");

const xml2js = require("xml2js");
const { serve } = require("@hono/node-server");
const { Hono } = require("hono");
const { createConnection } = require("./db");
const Cats = require("./Cats");
const { XMLParser } = require("fast-xml-parser");

async function main() {
  const app = new Hono();
  const db = await createConnection();
  const cats = new Cats(db);

  app.use(async (c, next) => {
    const userId = c.req.header("x-user-id");

    if (userId) {
      Zen.setUser({
        id: userId,
      });
    }

    await next();
  });

  Zen.addHonoMiddleware(app);

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
                      if(!data.success) {
                        throw new Error("Response was not successful");
                      }
                      window.location.reload();
                    })
                    .catch(error => document.getElementById("list").innerHTML = "<li>" + error.message + "</li>");
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

  app.get("/admin", async (c) => {
    return c.html(
      `<html lang="en">
        <body>
          <h1>Admin panel</h1>
        </body>
      </html>`
    );
  });

  app.get("/admin/public", async (c) => {
    return c.html(
      `<html lang="en">
        <body>
          <h1>Public subpage of the admin panel</h1>
        </body>
      </html>`
    );
  });

  app.post("/add-fast", async (c) => {
    const body = await c.req.text();

    let result;
    try {
      const parser = new XMLParser();
      result = await parser.parse(body);
    } catch (err) {
      return c.json({ error: "Invalid XML" }, 400);
    }

    await cats.add(result.cat.name);

    return c.json({ success: true });
  });

  app.post("/add-fast-attribute", async (c) => {
    const body = await c.req.text();

    let result;
    try {
      const parser = new XMLParser({
        ignoreAttributes: false,
      });
      result = await parser.parse(body);
    } catch (err) {
      return c.json({ error: "Invalid XML" }, 400);
    }
    await cats.add(result.cat["@_name"]);

    return c.json({ success: true });
  });

  app.get("/clear", async (c) => {
    try {
      await db.execute("DELETE FROM cats;");
      return c.redirect("/", 302);
    } catch (err) {
      return c.json({ error: "Failed to clear cats" }, 500);
    }
  });

  app.get("/fetch", async (c) => {
    const url = c.req.query("url");
    if (!url) {
      return c.json({ error: "url query param is required" }, 400);
    }
    const response = await fetch(url);
    const text = await response.text();
    return c.json({ success: true, status: response.status, body: text });
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
