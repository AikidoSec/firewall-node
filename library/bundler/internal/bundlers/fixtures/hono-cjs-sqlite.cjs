require("@aikidosec/firewall/instrument");

const Zen = require("@aikidosec/firewall");
const { serve } = require("@hono/node-server");
const { Hono } = require("hono");
const { Database } = require("sqlite3");

const db = new Database(":memory:");

const app = new Hono();

app.use(async (c, next) => {
  Zen.setUser({
    id: "id",
    name: "Name",
  });

  await next();
});

app.get("/", (c) => {
  db.exec("SELECT 1");
  return c.text("Hello world!");
});

const port = process.env.PORT || 3000;

serve({
  fetch: app.fetch,
  port: port,
}).on("listening", () => {
  // oxlint-disable-next-line no-console
  console.info(`Server is running on port ${port}`);
});
