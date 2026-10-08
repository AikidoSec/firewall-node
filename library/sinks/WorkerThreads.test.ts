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

  await runWithContext(dangerousCodeContext, async () => {
    // eval is truthy but not strictly `true` - Node still treats this as eval mode
    throws(
      () => new Worker("1 + 1; console.log('hello')", { eval: 1 as any }),
      "Zen has blocked a JavaScript injection: new Worker(...)(...) originating from body.code"
    );
  });

  await runSafeWorker(
    new URL(`data:text/javascript,${encodeURIComponent("console.log('hi')")}`)
  );

  await runWithContext(dangerousCodeContext, async () => {
    throws(
      () =>
        new Worker(
          new URL(
            `data:text/javascript,${encodeURIComponent(
              "1 + 1; console.log('hello')"
            )}`
          )
        ),
      "Zen has blocked a JavaScript injection: new Worker(...)(...) originating from body.code"
    );

    throws(
      () =>
        new Worker(
          new URL(
            `data:text/javascript;base64,${Buffer.from(
              "1 + 1; console.log('hello')"
            ).toString("base64")}`
          )
        ),
      "Zen has blocked a JavaScript injection: new Worker(...)(...) originating from body.code"
    );

    await new Promise<void>((resolve, reject) => {
      const worker = new Worker(
        new URL(
          `data:text/typescript,${encodeURIComponent("1 + 1; console.log('hello')")}`
        )
      );
      worker.on("error", (error) => {
        t.match(error.message, /Unknown module format/);
        resolve();
      });
      worker.on("exit", () =>
        reject(new Error("Expected worker to error out"))
      );
    });

    // Node only treats `data:` URLs as inline code when passed as an actual URL instance
    throws(
      () =>
        new Worker(
          `data:text/javascript,${encodeURIComponent(
            "1 + 1; console.log('hello')"
          )}`
        ),
      /Wrap data: URLs with `new URL`/
    );
  });

  class CustomWorker extends Worker {}

  const customWorker = new CustomWorker(helloWorldFixture);
  t.ok(customWorker instanceof CustomWorker, "preserves subclass prototype");
  await new Promise<void>((resolve, reject) => {
    customWorker.on("error", reject);
    customWorker.on("exit", () => resolve());
  });

  // Test ESM syntax detection in data URLs
  await runWithContext(dangerousCodeContext, async () => {
    throws(
      () =>
        new Worker(
          new URL(
            `data:text/javascript,${encodeURIComponent(
              "export default '1 + 1; console.log(\\'hello\\')'"
            )}`
          )
        ),
      "Zen has blocked a JavaScript injection: new Worker(...)(...) originating from body.code"
    );
  });
});

t.test("ESM Worker data URL bypass mitigation", async (t) => {
  const agent = createTestAgent();
  agent.start([new WorkerThreads()]);

  const { Worker } =
    require("worker_threads") as typeof import("worker_threads");

  // Test context with user-controlled input that could be injected
  const injectionContext: Context = {
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

  // Test 1: ESM export statement with injection attempt
  await runWithContext(injectionContext, async () => {
    throws(
      () =>
        new Worker(
          new URL(
            `data:text/javascript,${encodeURIComponent(
              "export const result = '1 + 1; console.log(\\'hello\\')'; console.log(result);"
            )}`
          )
        ),
      "Zen has blocked a JavaScript injection: new Worker(...)(...) originating from body.code"
    );
  });

  // Test 2: ESM import statement with injection attempt
  await runWithContext(injectionContext, async () => {
    throws(
      () =>
        new Worker(
          new URL(
            `data:text/javascript,${encodeURIComponent(
              "import { x } from 'module'; const code = '1 + 1; console.log(\\'hello\\')'; eval(code);"
            )}`
          )
        ),
      "Zen has blocked a JavaScript injection: new Worker(...)(...) originating from body.code"
    );
  });

  // Test 3: ESM export default with injection
  await runWithContext(injectionContext, async () => {
    throws(
      () =>
        new Worker(
          new URL(
            `data:text/javascript,${encodeURIComponent(
              "export default function() { return '1 + 1; console.log(\\'hello\\')'; }"
            )}`
          )
        ),
      "Zen has blocked a JavaScript injection: new Worker(...)(...) originating from body.code"
    );
  });

  // Test 4: ESM with dynamic import and injection
  await runWithContext(injectionContext, async () => {
    throws(
      () =>
        new Worker(
          new URL(
            `data:text/javascript,${encodeURIComponent(
              "const payload = '1 + 1; console.log(\\'hello\\')'; export { payload };"
            )}`
          )
        ),
      "Zen has blocked a JavaScript injection: new Worker(...)(...) originating from body.code"
    );
  });

  // Test 5: ESM with top-level await and injection
  await runWithContext(injectionContext, async () => {
    throws(
      () =>
        new Worker(
          new URL(
            `data:text/javascript,${encodeURIComponent(
              "const x = '1 + 1; console.log(\\'hello\\')'; await Promise.resolve(); export default x;"
            )}`
          )
        ),
      "Zen has blocked a JavaScript injection: new Worker(...)(...) originating from body.code"
    );
  });

  // Test 6: ESM with named exports and injection
  await runWithContext(injectionContext, async () => {
    throws(
      () =>
        new Worker(
          new URL(
            `data:text/javascript,${encodeURIComponent(
              "export const dangerous = '1 + 1; console.log(\\'hello\\')'; export function run() { eval(dangerous); }"
            )}`
          )
        ),
      "Zen has blocked a JavaScript injection: new Worker(...)(...) originating from body.code"
    );
  });

  // Test 7: ESM with re-export and injection
  await runWithContext(injectionContext, async () => {
    throws(
      () =>
        new Worker(
          new URL(
            `data:text/javascript,${encodeURIComponent(
              "const code = '1 + 1; console.log(\\'hello\\')'; export { code as payload };"
            )}`
          )
        ),
      "Zen has blocked a JavaScript injection: new Worker(...)(...) originating from body.code"
    );
  });

  // Test 8: Base64-encoded ESM data URL with injection
  await runWithContext(injectionContext, async () => {
    const esmCode = "export const x = '1 + 1; console.log(\\'hello\\')';";
    throws(
      () =>
        new Worker(
          new URL(
            `data:text/javascript;base64,${Buffer.from(esmCode).toString("base64")}`
          )
        ),
      "Zen has blocked a JavaScript injection: new Worker(...)(...) originating from body.code"
    );
  });

  // Test 9: Safe ESM code without injection should work
  await runWithContext(injectionContext, async () => {
    const safeWorker = new Promise<void>((resolve, reject) => {
      const worker = new Worker(
        new URL(
          `data:text/javascript,${encodeURIComponent(
            "export const safe = 'safe value'; console.log('safe');"
          )}`
        )
      );
      worker.on("error", reject);
      worker.on("exit", () => resolve());
    });
    await safeWorker;
  });

  // Test 10: ESM with string breakout attempt
  const breakoutContext: Context = {
    remoteAddress: "::1",
    method: "POST",
    url: "http://localhost:4000",
    query: {},
    headers: {},
    body: {
      userInput: "'; console.log('injected'); //",
    },
    cookies: {},
    routeParams: {},
    source: "express",
    route: "/posts/:id",
  };

  await runWithContext(breakoutContext, async () => {
    throws(
      () =>
        new Worker(
          new URL(
            `data:text/javascript,${encodeURIComponent(
              "export const data = '\\'; console.log(\\'injected\\'); //';"
            )}`
          )
        ),
      "Zen has blocked a JavaScript injection: new Worker(...)(...) originating from body.userInput"
    );
  });

  // Test 11: ESM with template literal injection
  const templateContext: Context = {
    remoteAddress: "::1",
    method: "POST",
    url: "http://localhost:4000",
    query: {},
    headers: {},
    body: {
      template: "${console.log('pwned')}",
    },
    cookies: {},
    routeParams: {},
    source: "express",
    route: "/posts/:id",
  };

  await runWithContext(templateContext, async () => {
    throws(
      () =>
        new Worker(
          new URL(
            `data:text/javascript,${encodeURIComponent(
              "export const msg = `Hello ${console.log('pwned')}`;"
            )}`
          )
        ),
      "Zen has blocked a JavaScript injection: new Worker(...)(...) originating from body.template"
    );
  });
});
