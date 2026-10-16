import * as t from "tap";
import { createTestAgent } from "../../../helpers/createTestAgent";
import * as mod from "node:module";
import { isNewInstrumentationUnitTest } from "../../../helpers/isNewInstrumentationUnitTest";
import { isEsmUnitTest } from "../../../helpers/isEsmUnitTest";
import { registerNodeHooks } from "./index";
import { type Context, runWithContext } from "../../Context";

const skip = !("registerHooks" in mod) || !isEsmUnitTest();

function getCodeString(code: string): string {
  return `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
}

function contextWithCode(code: unknown): Context {
  return {
    remoteAddress: "::1",
    method: "POST",
    url: "http://localhost:4000",
    query: {},
    headers: {},
    body: {
      code: code,
    },
    cookies: {},
    routeParams: {},
    source: "express",
    route: "/posts/:id",
  };
}

t.before(() => {
  if (skip) {
    return;
  }

  createTestAgent();

  registerNodeHooks();
});

t.test(
  "dynamic import with an export still works normally",
  {
    skip,
  },
  async (t) => {
    const testResult = await import(
      getCodeString(`export const value = "export works";`)
    );

    t.equal(testResult.value, "export works");
  }
);

t.test(
  "without context, dangerous code is not blocked",
  {
    skip,
  },
  async (t) => {
    const code = "1 + 1; console.log('without context')";

    await import(getCodeString(code));
  }
);

t.test(
  "with context, code that does not match user input is not blocked",
  {
    skip,
  },
  async (t) => {
    const code = "console.log('with context, no injection')";

    await runWithContext(contextWithCode("some unrelated value"), async () => {
      await import(getCodeString(code));
    });
  }
);

t.test(
  "with context, matching code is blocked",
  {
    skip,
  },
  async (t) => {
    const code = "1 + 1; console.log('with context, injection')";

    await runWithContext(contextWithCode(code), async () => {
      const error = await t.rejects(async () => {
        await import(getCodeString(code));
      });

      t.ok(error instanceof Error);
      if (error instanceof Error) {
        t.match(
          error.message,
          "Zen has blocked a JavaScript injection: await import(...)(...) originating from body.code"
        );
      }
    });
  }
);

t.test(
  "with context, matching ESM-shaped code using export is blocked",
  {
    skip,
  },
  async (t) => {
    const code =
      "export const value = 'esm injection'; console.log('with context, esm injection')";

    await runWithContext(contextWithCode(code), async () => {
      const error = await t.rejects(async () => {
        await import(getCodeString(code));
      });

      t.ok(error instanceof Error);
      if (error instanceof Error) {
        t.match(
          error.message,
          "Zen has blocked a JavaScript injection: await import(...)(...) originating from body.code"
        );
      }
    });
  }
);
