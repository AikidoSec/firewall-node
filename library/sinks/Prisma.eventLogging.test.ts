import * as t from "tap";
import { wrap } from "../helpers/wrap";
import { runWithContext, type Context } from "../agent/Context";
import { Prisma } from "./Prisma";
import { createTestAgent } from "../helpers/createTestAgent";
import { promisify } from "util";
import { exec as execCb } from "child_process";
import { join } from "path";
import { LockFile } from "../helpers/LockFile";

const execAsync = promisify(execCb);

const context: Context = {
  remoteAddress: "::1",
  method: "POST",
  url: "http://localhost:4000",
  query: {},
  headers: {},
  body: {
    myTitle: `-- should be blocked`,
  },
  cookies: {},
  routeParams: {},
  source: "express",
  route: "/posts/:id",
};

t.test(
  "it does not instrument when event-based logging is enabled",
  async (t) => {
    const lock = new LockFile("prisma-shared");

    await lock.withLock(async () => {
      const agent = createTestAgent();
      agent.start([new Prisma()]);

      process.env.DATABASE_URL =
        "postgres://root:password@127.0.0.1:27016/main_db";

      await execAsync("npx prisma migrate reset --force", {
        cwd: join(__dirname, "fixtures/prisma/postgres"),
      });

      const { PrismaClient } = require("@prisma/client");

      const logs: string[] = [];
      wrap(console, "warn", function warn() {
        return function warn(message: string) {
          logs.push(message);
        };
      });

      // Create client with event-based logging
      const client = new PrismaClient({
        log: [{ emit: "event", level: "query" }],
      });

      // Should have logged a warning
      t.ok(
        logs.some((w) => w.includes("AIKIDO: Prisma instrumentation disabled")),
        "Should log warning about disabled instrumentation"
      );

      // $on() should work (wouldn't work if we extended the client)
      let queryEventFired = false;
      client.$on("query", () => {
        queryEventFired = true;
      });

      await client.appUser.findMany();

      t.ok(queryEventFired, "$on() should work when instrumentation is disabled");

      // SQL injection should NOT be blocked (because instrumentation is disabled)
      await runWithContext(context, async () => {
        const result = await client.$queryRawUnsafe(
          'SELECT * FROM "AppUser" -- should be blocked'
        );
        t.ok(
          Array.isArray(result),
          "Query should not be blocked when instrumentation is disabled"
        );
      });

      await client.$disconnect();
    });
  }
);
