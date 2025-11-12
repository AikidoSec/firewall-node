import * as t from "tap";
import { runWithContext, type Context } from "../agent/Context";
import { Prisma } from "./Prisma";
import { createTestAgent } from "../helpers/createTestAgent";
import { promisify } from "util";
import { exec as execCb } from "child_process";
import { join } from "path";
import { LockFile } from "../helpers/LockFile";

const execAsync = promisify(execCb);

const noSQLContext: Context = {
  remoteAddress: "::1",
  method: "POST",
  url: "http://localhost:4000",
  query: {},
  headers: {},
  body: {
    email: {
      $ne: null,
    },
  },
  cookies: {},
  routeParams: {},
  source: "express",
  route: "/posts/:id",
};

t.test("it works with mongodb", async (t) => {
  const lock = new LockFile("prisma-shared");

  await lock.withLock(async () => {
    const agent = createTestAgent();
    agent.start([new Prisma()]);

    process.env.DATABASE_URL =
      "mongodb://root:password@127.0.0.1:27020/prisma?authSource=admin&directConnection=true";

    // Generate prismajs client
    await execAsync(
      "npx prisma generate", // Generate prisma client, reset db and apply migrations
      {
        cwd: join(__dirname, "fixtures/prisma/mongodb"),
      }
    );

    let operationCount = 0;

    const { PrismaClient } = require("@prisma/client");

    const client = new PrismaClient().$extends({
      query: {
        $allOperations: ({
          model,
          operation,
          args,
          query,
        }: {
          model?: string;
          operation: string;
          args: unknown;
          query: (args: unknown) => Promise<unknown>;
        }) => {
          operationCount++;
          return query(args);
        },
      },
    });

    await client.user.create({
      data: {
        name: "Alice",
        email: "alice@example.com",
      },
    });

    t.match(await client.user.findMany(), [
      {
        email: "alice@example.com",
        name: "Alice",
      },
    ]);

    t.match(
      await client.user.findRaw({
        filter: {
          email: { $ne: null },
        },
      }),
      [
        {
          email: "alice@example.com",
          name: "Alice",
        },
      ]
    );

    await runWithContext(noSQLContext, async () => {
      try {
        await client.user.findRaw({
          filter: {
            email: { $ne: null },
          },
        });
        t.fail("Execution should be blocked");
      } catch (error) {
        t.ok(error instanceof Error);
        if (error instanceof Error) {
          t.same(
            error.message,
            "Zen has blocked a NoSQL injection: prisma.findRaw(...) originating from body.email"
          );
        }
      }
    });

    await runWithContext(noSQLContext, async () => {
      try {
        await client.user.aggregateRaw({
          pipeline: [{ $match: { email: { $ne: null } } }],
        });
        t.fail("Execution should be blocked");
      } catch (error) {
        t.ok(error instanceof Error);
        if (error instanceof Error) {
          t.same(
            error.message,
            "Zen has blocked a NoSQL injection: prisma.aggregateRaw(...) originating from body.email"
          );
        }
      }
    });

    t.same(operationCount, 3);

    await client.user.deleteMany();

    await client.$disconnect();
  });
});
