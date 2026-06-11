import { Elysia, t } from "elysia";
import { node } from "@elysia/node";
import { createConnection } from "./db.ts";
import Zen from "@aikidosec/firewall";

const db = await createConnection();

new Elysia({ adapter: node() })
  .get("/", () => "Hello world")
  .onBeforeHandle(Zen.elysiaHandler)
  .post(
    "/add",
    async ({ body, status }) => {
      // Insecure
      await db.query(`INSERT INTO cats_7 (petname) VALUES ('${body.name}');`);
      return status(200, "OK");
    },
    {
      body: t.Object({
        name: t.String(),
      }),
    }
  )
  .get("/clear", async ({ status }) => {
    await db.query("DELETE FROM cats_7;");
    return status(200, "Table cleared");
  })
  .listen(process.env.PORT || 4000, ({ hostname, port }) => {
    console.log(`Server is running at ${hostname}:${port}`);
  });

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, async () => {
    await db.end();
    process.exit(0);
  });
}
