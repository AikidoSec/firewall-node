require("@aikidosec/firewall");

const { serve } = require("@hono/node-server");
const { Hono } = require("hono");
const { getDB } = require("./db");
const Aikido = require("@aikidosec/firewall/context");
const Cats = require("./Cats");

async function main() {
  const app = new Hono();
  const db = await getDB();
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
            <h1>Vulnerable app using SQLite3</h1>
            <ul id="list">
              ${catNames.map((name) => `<li>${name}</li>`).join("")}
            </ul>
            <form id="add-cat">
              <label for="search">Add a new cat</label>
              <input type="text" name="petname">
              <input type="submit" value="Add" />
            </form>
            <p>SQL Injection: Test'), ('Test2');--</p>
            <a href="/clear">Clear all cats</a>
            <script>
              document.addEventListener("DOMContentLoaded", () => {
                const form = document.getElementById("add-cat");
                form.addEventListener("submit", async (event) => {
                  event.preventDefault();
                  fetch("/add", {
                    method: "POST",
                    body: JSON.stringify({ name: form.petname.value }),
                    headers: {
                      "Content-Type": "application/json"
                    }
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
    const body = await c.req.json();

    if (typeof body.name !== "string") {
      return c.json({ error: "Invalid request" }, 400);
    }

    await cats.add(body.name);
    return c.json({ success: true });
  });

  app.get("/clear", async (c) => {
    try {
      await new Promise((resolve, reject) => {
        db.run("DELETE FROM cats;", (result, err) => {
          if (err) {
            return reject(err);
          }
          resolve(result);
        });
      });
      return c.redirect("/", 302);
    } catch (err) {
      return c.json({ error: "Failed to clear cats" }, 500);
    }
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
