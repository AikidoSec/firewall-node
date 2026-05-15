import * as t from "tap";
import { runWithContext, type Context } from "../agent/Context";
import { Prisma as PrismaSink } from "./Prisma";
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

const testOpts = {};

t.test("it works with sqlite", testOpts, async (t) => {
  const lock = new LockFile("prisma-shared");

  await lock.withLock(async () => {
    const agent = createTestAgent();
    agent.start([new PrismaSink()]);

    process.env.DATABASE_URL = "file:./dev.db";

    // Generate prismajs client
    await execAsync(
      "npx prisma migrate reset --force", // Generate prisma client, reset db and apply migrations
      {
        cwd: join(__dirname, "fixtures/prisma/sqlite"),
      }
    );

    const { PrismaClient, Prisma } = require("@prisma/client");

    const client = new PrismaClient();

    await client.user.create({
      data: {
        name: "Alice",
        email: "alice@example.com",
      },
    });

    t.same(await client.$queryRawUnsafe("SELECT * FROM USER"), [
      {
        id: 1,
        name: "Alice",
        email: "alice@example.com",
      },
    ]);

    t.same(await client.$queryRaw(Prisma.raw('SELECT * FROM "USER";')), [
      {
        id: 1,
        name: "Alice",
        email: "alice@example.com",
      },
    ]);

    t.same(
      await client.$queryRaw`SELECT * FROM "USER" WHERE name = ${"Alice"};`,
      [
        {
          id: 1,
          name: "Alice",
          email: "alice@example.com",
        },
      ]
    );
    t.same(
      await client.$queryRaw`SELECT * FROM "USER" WHERE name = ${"Alice"}; ${Prisma.raw("-- should not be blocked")}`,
      [
        {
          id: 1,
          name: "Alice",
          email: "alice@example.com",
        },
      ]
    );

    await runWithContext(context, async () => {
      t.same(await client.$queryRawUnsafe("SELECT * FROM USER"), [
        {
          id: 1,
          name: "Alice",
          email: "alice@example.com",
        },
      ]);

      try {
        await client.$queryRawUnsafe("SELECT * FROM USER -- should be blocked");
        t.fail("Query should be blocked");
      } catch (error) {
        t.ok(error instanceof Error);
        if (error instanceof Error) {
          t.same(
            error.message,
            "Zen has blocked an SQL injection: prisma.$queryRawUnsafe(...) originating from body.myTitle"
          );
        }
      }

      try {
        await client.$queryRaw(
          Prisma.raw('SELECT * FROM "USER" -- should be blocked')
        );
        t.fail("Query should be blocked");
      } catch (error) {
        t.ok(error instanceof Error);
        if (error instanceof Error) {
          t.same(
            error.message,
            "Zen has blocked an SQL injection: prisma.$queryRaw(...) originating from body.myTitle"
          );
        }
      }

      try {
        await client.$queryRaw`SELECT * FROM "USER" WHERE name = ${"Alice"}; ${Prisma.raw("-- should be blocked")}`;
        t.fail("Query should be blocked");
      } catch (error) {
        t.ok(error instanceof Error);
        if (error instanceof Error) {
          t.same(
            error.message,
            "Zen has blocked an SQL injection: prisma.$queryRaw(...) originating from body.myTitle"
          );
        }
      }
    });

    await client.$executeRawUnsafe("DELETE FROM USER WHERE id = 1");

    await client.user.create({
      data: {
        name: "Alice2",
        email: "alice2@example.com",
      },
    });

    await runWithContext(context, async () => {
      await client.$executeRawUnsafe("DELETE FROM USER WHERE id = 2");

      try {
        await client.$executeRawUnsafe("DELETE FROM USER WHERE id = 2");
        await client.$executeRawUnsafe(
          "DELETE FROM USER WHERE id = 1 -- should be blocked"
        );
        t.fail("Execution should be blocked");
      } catch (error) {
        t.ok(error instanceof Error);
        if (error instanceof Error) {
          t.same(
            error.message,
            "Zen has blocked an SQL injection: prisma.$executeRawUnsafe(...) originating from body.myTitle"
          );
        }
      }

      try {
        await client.$executeRawUnsafe();
        t.fail("Should not be reached");
      } catch (error) {
        t.ok(error instanceof Error);
        if (error instanceof Error) {
          t.match(
            error.message,
            /Invalid `prisma\.\$executeRawUnsafe\(\)` invocation/
          );
        }
      }
    });

    await client.$disconnect();
  });
});
