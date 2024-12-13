import * as t from "tap";
import { runWithContext, type Context } from "../agent/Context";
import { Prisma } from "./Prisma";
import { createTestAgent } from "../helpers/createTestAgent";
import { promisify } from "util";
import { exec as execCb } from "child_process";
import * as path from "path";

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

const testOpts = {};

t.test("it works with sqlite", testOpts, async (t) => {
  const agent = createTestAgent();
  agent.start([new Prisma()]);

  process.env.DATABASE_URL = "file:./dev.db";

  // Generate prismajs client
  const { stdout, stderr } = await execAsync(
    "npx prisma migrate reset --force", // Generate prisma client, reset db and apply migrations
    {
      cwd: path.join(__dirname, "fixtures/prisma/sqlite"),
    }
  );

  if (stderr) {
    t.fail(stderr);
  }

  const { PrismaClient } = require("@prisma/client");

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

t.test("it works with postgres", testOpts, async (t) => {
  const agent = createTestAgent();
  agent.start([new Prisma()]);

  process.env.DATABASE_URL = "postgres://root:password@127.0.0.1:27016/main_db";

  // Generate prismajs client
  const { stdout, stderr } = await execAsync(
    "npx prisma migrate reset --force", // Generate prisma client, reset db and apply migrations
    {
      cwd: path.join(__dirname, "fixtures/prisma/postgres"),
    }
  );

  if (stderr) {
    t.fail(stderr);
  }

  // Clear require cache
  for (const key in require.cache) {
    delete require.cache[key];
  }

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

t.test("it works with mongodb", testOpts, async (t) => {
  const agent = createTestAgent();
  agent.start([new Prisma()]);

  process.env.DATABASE_URL =
    "mongodb://root:password@127.0.0.1:27020/prisma?authSource=admin&directConnection=true";

  // Generate prismajs client
  const { stdout, stderr } = await execAsync(
    "npx prisma generate", // Generate prisma client, reset db and apply migrations
    {
      cwd: path.join(__dirname, "fixtures/prisma/mongodb"),
    }
  );

  if (stderr) {
    t.fail(stderr);
  }

  // Clear require cache
  for (const key in require.cache) {
    delete require.cache[key];
  }

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
