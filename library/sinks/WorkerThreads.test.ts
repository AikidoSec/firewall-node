import * as t from "tap";
import { join } from "path";
import { Context, runWithContext } from "../agent/Context";
import { createTestAgent } from "../helpers/createTestAgent";
import { WorkerThreads } from "./WorkerThreads";

const helloWorldFixture = join(__dirname, "./fixtures/helloWorld.js");

const dangerousCodeContext: Context = {
  remoteAddress: "::1",
  method: "POST",
  url: "http://localhost:4000",
  query: {},
  headers: {},
  body: {
    code: "1 + 1; console.log('hello')",
  },
  cookies: {},
  routeParams: {},
  source: "express",
  route: "/posts/:id",
};

const unsafePathContext: Context = {
  remoteAddress: "::1",
  method: "POST",
  url: "http://localhost:4000",
  query: {},
  headers: {},
  body: {
    file: {
      matches: "../test.txt",
    },
  },
  cookies: {},
  routeParams: {},
  source: "express",
  route: "/posts/:id",
};

function throws(fn: () => void, wanted: string | RegExp) {
  const error = t.throws(fn);
  if (error instanceof Error) {
    t.match(error.message, wanted);
  }
}

t.test("it works", async (t) => {
  const agent = createTestAgent();
  agent.start([new WorkerThreads()]);

  const { Worker } =
    require("worker_threads") as typeof import("worker_threads");

  const runCommandsWithInvalidArgs = () => {
    // @ts-expect-error Test
    throws(() => new Worker(), /Received undefined/);
  };

  runCommandsWithInvalidArgs();

  runWithContext(dangerousCodeContext, () => {
    runCommandsWithInvalidArgs();
  });

  const runSafeWorker = (...args: ConstructorParameters<typeof Worker>) => {
    return new Promise<void>((resolve, reject) => {
      const worker = new Worker(...args);
      worker.on("error", reject);
      worker.on("exit", () => resolve());
    });
  };

  await runSafeWorker("1 + 1", { eval: true });
  await runSafeWorker(helloWorldFixture);
  await runSafeWorker(new URL(`file://${helloWorldFixture}`));

  await runWithContext(dangerousCodeContext, async () => {
    await runSafeWorker("1 + 1", { eval: true });
  });

  await runWithContext(dangerousCodeContext, async () => {
    throws(
      () => new Worker("1 + 1; console.log('hello')", { eval: true }),
      "Zen has blocked a JavaScript injection: new Worker(...)(...) originating from body.code"
    );
  });

  runWithContext(dangerousCodeContext, () => {
    throws(
      () => new Worker("1 + 1", "not-an-object" as any),
      /Received "1 \+ 1"/
    );
    throws(
      () => new Worker("1 + 1", null as any),
      /Cannot read properties of null/
    );
  });

  await runWithContext(unsafePathContext, async () => {
    await runSafeWorker(helloWorldFixture);

    throws(
      () => new Worker("../../test.txt", { eval: false }),
      "Zen has blocked a path traversal attack: new Worker(...)(...) originating from body.file.matches"
    );

    throws(
      () => new Worker(new URL("file:///../test.txt"), { eval: false }),
      "Zen has blocked a path traversal attack: new Worker(...)(...) originating from body.file.matches"
    );

    throws(
      () => new Worker(Buffer.from("../test.txt") as any),
      /Received an instance of Buffer/
    );
  });
});
