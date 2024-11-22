import * as t from "tap";
import { runWithContext, type Context } from "../agent/Context";
import { Prisma } from "./Prisma";
import { createTestAgent } from "../helpers/createTestAgent";
import { promisify } from "util";
import { exec as execCb } from "child_process";
import path = require("path");

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

t.test("it inspects query method calls and blocks if needed", async (t) => {
  const agent = createTestAgent();
  agent.start([new Prisma()]);

  // Generate prismajs client
  const { stdout, stderr } = await execAsync(
    "npx prisma migrate reset --force", // Generate prisma client, reset db and apply migrations
    {
      cwd: path.join(__dirname, "fixtures"),
    }
  );

  if (stderr) {
    t.fail(stderr);
  }

  const { PrismaClient } = require("@prisma/client");

  const client = new PrismaClient();

  const user = await client.user.create({
    data: {
      name: "Alice",
      email: "alice@example.com",
    },
  });

  t.same(await client.$queryRawUnsafe("SELECT * FROM USER"), [
    {
      id: user.id,
      name: "Alice",
      email: "alice@example.com",
    },
  ]);

  await runWithContext(context, async () => {
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
});
