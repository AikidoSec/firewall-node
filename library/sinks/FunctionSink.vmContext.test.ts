/* oxlint-disable no-implied-eval */
/* oxlint-disable no-eval */
import * as t from "tap";
import { runWithContext, type Context } from "../agent/Context";
import { createTestAgent } from "../helpers/createTestAgent";
import { FunctionSink } from "./FunctionSink";
import { NodeVm } from "./NodeVm";

const requestContext: Context = {
  remoteAddress: "::1",
  method: "POST",
  url: "http://localhost:4000",
  query: {},
  headers: {},
  body: {},
  cookies: {},
  routeParams: {},
  source: "express",
  route: "/posts/:id",
};

let baselineMessage: string;

t.test(
  "vm.createContext(sandbox, { codeGeneration: { strings: false } }) blocks new Function on its own",
  async (t) => {
    const vm = require("vm");
    const sandbox = vm.createContext(
      {},
      { codeGeneration: { strings: false } }
    );

    const error = t.throws(() =>
      vm.runInContext("new Function('return 1')()", sandbox)
    ) as Error;
    t.equal(error.name, "EvalError");
    baselineMessage = error.message;
  }
);

t.test("Zen keeps that denial in place for vm.createContext", async (t) => {
  createTestAgent().start([new NodeVm(), new FunctionSink()]);
  const vm = require("vm");

  runWithContext(requestContext, () => {
    const sandbox = vm.createContext(
      {},
      { codeGeneration: { strings: false } }
    );
    const error = t.throws(() =>
      vm.runInContext("new Function('return 1')()", sandbox)
    ) as Error;
    t.equal(error.name, "EvalError");
    t.equal(error.message, baselineMessage);

    const sandboxNoOptions = vm.createContext({});
    t.equal(vm.runInContext("new Function('return 1')()", sandboxNoOptions), 1);

    const sandboxEmptyOptions = vm.createContext({}, {});
    t.equal(
      vm.runInContext("new Function('return 1')()", sandboxEmptyOptions),
      1
    );

    const sandboxStringsTrue = vm.createContext(
      {},
      { codeGeneration: { strings: true } }
    );
    t.equal(
      vm.runInContext("new Function('return 1')()", sandboxStringsTrue),
      1
    );

    const sandboxWrongKey = vm.createContext(
      {},
      { contextCodeGeneration: { strings: false } }
    );
    t.equal(vm.runInContext("new Function('return 1')()", sandboxWrongKey), 1);
  });
});

t.test("Zen keeps that denial in place for vm.runInNewContext", async (t) => {
  const vm = require("vm");

  runWithContext(requestContext, () => {
    const error = t.throws(() =>
      vm.runInNewContext(
        "new Function('return 1')()",
        {},
        { contextCodeGeneration: { strings: false } }
      )
    ) as Error;
    t.equal(error.name, "EvalError");
    t.equal(error.message, baselineMessage);

    t.equal(vm.runInNewContext("new Function('return 1')()", {}), 1);

    t.equal(vm.runInNewContext("new Function('return 1')()", {}, {}), 1);

    t.equal(
      vm.runInNewContext(
        "new Function('return 1')()",
        {},
        { contextCodeGeneration: { strings: true } }
      ),
      1
    );

    t.equal(
      vm.runInNewContext(
        "new Function('return 1')()",
        {},
        { codeGeneration: { strings: false } }
      ),
      1
    );
  });
});

t.test(
  "Zen keeps that denial in place for Script.prototype.runInNewContext",
  async (t) => {
    const vm = require("vm");

    runWithContext(requestContext, () => {
      const error = t.throws(() =>
        new vm.Script("new Function('return 1')()").runInNewContext(
          {},
          { contextCodeGeneration: { strings: false } }
        )
      ) as Error;
      t.equal(error.name, "EvalError");
      t.equal(error.message, baselineMessage);

      t.equal(
        new vm.Script("new Function('return 1')()").runInNewContext({}),
        1
      );

      t.equal(
        new vm.Script("new Function('return 1')()").runInNewContext({}, {}),
        1
      );

      t.equal(
        new vm.Script("new Function('return 1')()").runInNewContext(
          {},
          { contextCodeGeneration: { strings: true } }
        ),
        1
      );

      t.equal(
        new vm.Script("new Function('return 1')()").runInNewContext(
          {},
          { codeGeneration: { strings: false } }
        ),
        1
      );
    });
  }
);

t.test(
  "Zen keeps that denial in place for Script.prototype.runInContext",
  async (t) => {
    const vm = require("vm");

    runWithContext(requestContext, () => {
      const sandbox = vm.createContext(
        {},
        { codeGeneration: { strings: false } }
      );
      const error = t.throws(() =>
        new vm.Script("new Function('return 1')()").runInContext(sandbox)
      ) as Error;
      t.equal(error.name, "EvalError");
      t.equal(error.message, baselineMessage);

      const unrestrictedSandbox = vm.createContext({});
      t.equal(
        new vm.Script("new Function('return 1')()").runInContext(
          unrestrictedSandbox
        ),
        1
      );
    });
  }
);

t.test(
  "Zen keeps that denial in place when contextObject is omitted",
  async (t) => {
    const vm = require("vm");

    runWithContext(requestContext, () => {
      const error1 = t.throws(() =>
        vm.runInNewContext("new Function('return 1')()", undefined, {
          contextCodeGeneration: { strings: false },
        })
      ) as Error;
      t.equal(error1.name, "EvalError");
      t.equal(error1.message, baselineMessage);

      const error2 = t.throws(() =>
        new vm.Script("new Function('return 1')()").runInNewContext(undefined, {
          contextCodeGeneration: { strings: false },
        })
      ) as Error;
      t.equal(error2.name, "EvalError");
      t.equal(error2.message, baselineMessage);
    });
  }
);

t.test(
  "denial survives an async continuation scheduled from inside the sandbox",
  async (t) => {
    const vm = require("vm");

    runWithContext(requestContext, () => {
      const sandbox = vm.createContext(
        {
          report: (name: string) => {
            t.equal(name, "EvalError");
            t.end();
          },
        },
        { codeGeneration: { strings: false } }
      );

      vm.runInContext(
        `Promise.resolve().then(() => {
          try {
            new Function('return 1')();
            report("NOT_BLOCKED");
          } catch (e) {
            report(e.name);
          }
        });`,
        sandbox
      );
    });
  }
);

t.test("a context that never opted out is unaffected", async (t) => {
  const vm = require("vm");

  runWithContext(requestContext, () => {
    const sandbox = vm.createContext({});
    t.equal(vm.runInContext("new Function('return 1')()", sandbox), 1);
  });
});
