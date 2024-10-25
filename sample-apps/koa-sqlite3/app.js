const Zen = require("@aikidosec/firewall");

const Koa = require("koa");
const Router = require("@koa/router");
const { koaBody } = require("koa-body");
const { getDB } = require("./db");
const Aikido = require("@aikidosec/firewall/context");
const Cats = require("./Cats");

async function main() {
  const app = new Koa();
  const db = await getDB();
  const cats = new Cats(db);

  app.use(koaBody());

  app.use(async (ctx, next) => {
    Aikido.setUser({
      id: "id",
      name: "Name",
    });

    await next();
  });

  Zen.addKoaMiddleware(app);

  const router = new Router();

  router.get("/", async (ctx) => {
    const catNames = await cats.getAll();
    ctx.type = "text/html";
    ctx.body = `
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
      `;
  });

  router.post("/add", async (ctx) => {
    const body = ctx.request.body;

    if (typeof body.name !== "string") {
      ctx.type = "application/json";
      ctx.status = 400;
      ctx.body = { error: "Invalid request" };
      return;
    }

    await cats.add(body.name);
    ctx.type = "application/json";
    ctx.body = { success: true };
  });

  router.get("/clear", async (ctx) => {
    try {
      await new Promise((resolve, reject) => {
        db.run("DELETE FROM cats;", (result, err) => {
          if (err) {
            return reject(err);
          }
          resolve(result);
        });
      });
      ctx.redirect("/");
    } catch (err) {
      ctx.status = 500;
      ctx.type = "application/json";
      ctx.body = { error: "Failed to clear cats" };
    }
  });

  app.use(router.routes());

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

  app.listen(port, () => {
    console.log(`Listening on port ${port}`);
  });
});
