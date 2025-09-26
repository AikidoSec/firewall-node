import * as t from "tap";
import { runWithContext, type Context } from "../agent/Context";
import { Prisma } from "./Prisma";
import { createTestAgent } from "../helpers/createTestAgent";
import { promisify } from "util";
import { exec as execCb } from "child_process";
import { join } from "path";
import { TestLock } from "./testLock";

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

t.test("it works with postgres", testOpts, async (t) => {
  const lock = new TestLock("prisma-shared");

  await lock.withLock(async () => {
    const agent = createTestAgent();
    agent.start([new Prisma()]);

    process.env.DATABASE_URL =
      "postgres://root:password@127.0.0.1:27016/main_db";

    // Generate prismajs client
    await execAsync(
      "npx prisma migrate reset --force", // Generate prisma client, reset db and apply migrations
      {
        cwd: join(__dirname, "fixtures/prisma/postgres"),
      }
    );

    const { PrismaClient } = require("@prisma/client");

    const client = new PrismaClient();

    await client.appUser.create({
      data: {
        name: "Alice",
        email: "alice@example.com",
      },
    });

    t.same(await client.$queryRawUnsafe('SELECT * FROM "AppUser";'), [
      {
        id: 1,
        name: "Alice",
        email: "alice@example.com",
      },
    ]);

    await runWithContext(context, async () => {
      t.same(await client.$queryRawUnsafe('SELECT * FROM "AppUser";'), [
        {
          id: 1,
          name: "Alice",
          email: "alice@example.com",
        },
      ]);

      try {
        await client.$queryRawUnsafe(
          'SELECT * FROM "AppUser" -- should be blocked'
        );
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
    });

    await client.$executeRawUnsafe('DELETE FROM "AppUser" WHERE id = 1');

    await client.appUser.create({
      data: {
        name: "Alice2",
        email: "alice2@example.com",
      },
    });

    await runWithContext(context, async () => {
      await client.$executeRawUnsafe('DELETE FROM "AppUser" WHERE id = 2');

      try {
        await client.$executeRawUnsafe('DELETE FROM "AppUser" WHERE id = 2');
        await client.$executeRawUnsafe(
          'DELETE FROM "AppUser" WHERE id = 1 -- should be blocked'
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
    });

    await client.$disconnect();
  });
});
