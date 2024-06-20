require("@aikidosec/firewall");

const xml2js = require("xml2js");
const { serve } = require("@hono/node-server");
const { Hono } = require("hono");
const Aikido = require("@aikidosec/firewall/context");

async function main() {
  const app = new Hono();

  app.use(async (c, next) => {
    Aikido.setUser({
      id: "id",
      name: "Name",
    });

    await next();
  });

  app.get("/", async (c) => {
    return c.html(
      `
        <html lang="en">
          <body>
            <h1>Vulnerable app using XML</h1>
            <script>
              document.addEventListener("DOMContentLoaded", () => {
                fetch("/search", {
                  method: "POST",
                  body: "<search><cat><name>Test</name></cat></search>"
                }).then(response => response.json())
                  .then(data => console.log(data))
                  .catch(error => console.error(error));
              });
            </script>
          </body>
        </html>
      `
    );
  });

  app.post("/search", async (c) => {
    const body = await c.req.text();

    let result;
    try {
      const parser = new xml2js.Parser();
      result = await parser.parseStringPromise(body);
    } catch (err) {
      return c.json({ error: "Invalid XML" }, 400);
    }

    return c.json(result);
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
