import * as t from "tap";
import { Context, runWithContext } from "../agent/Context";
import { createTestAgent } from "../helpers/createTestAgent";
import { NodeVm } from "./NodeVm";

const unsafeContext = {
  remoteAddress: "::1",
  method: "POST",
  url: "http://localhost:4000",
  query: {},
  headers: {},
  body: {
    code: "'); require('child_process').execSync('id'); //",
  },
  cookies: {},
  routeParams: {},
  source: "express",
  route: "/posts/:id",
} satisfies Context;

const safeContext = {
  ...unsafeContext,
  body: { code: "Hello, world!" },
} satisfies Context;

t.test("it works", async (t) => {
  const agent = createTestAgent();

  agent.start([new NodeVm()]);

  const vm = require("vm");

  {
    // @ts-expect-error Not typed
    globalThis.__test = "test";
    const script = new vm.Script("globalThis.__test = 'modified';");
    script.runInThisContext();
    // @ts-expect-error Not typed
    t.equal(globalThis.__test, "modified");
    // @ts-expect-error Not typed
    delete globalThis.__test;
  }

  {
    const contextObject = { globalVar: 1 };
    vm.createContext(contextObject);
    vm.runInContext("globalVar *= 2;", contextObject);
    t.same(contextObject.globalVar, 2);
  }

  runWithContext(safeContext, () => {
    t.doesNotThrow(() => {
      new vm.Script(`console.log('${safeContext.body.code}');`);
    });
    t.doesNotThrow(() => {
      vm.runInThisContext(`console.log('${safeContext.body.code}');`);
    });

    const contextObject = { globalVar: 1 };
    vm.createContext(contextObject);
    vm.runInContext("globalVar *= 2;", contextObject);
    t.same(contextObject.globalVar, 2);

    // Call with wrong arguments
    t.throws(() => {
      vm.createScript({});
    }, /Unexpected identifier/);
  });

  runWithContext(unsafeContext, () => {
    t.throws(() => {
      new vm.Script(`console.log('${unsafeContext.body.code}');`);
    }, /Zen has blocked a JavaScript injection: new Script/);

    const functionsToTest = [
      "createScript",
      "runInThisContext",
      "runInNewContext",
      "runInContext",
      "compileFunction",
    ];

    for (const funcName of functionsToTest) {
      t.throws(
        () => {
          vm[funcName](`console.log('${unsafeContext.body.code}');`);
        },
        new RegExp(`Zen has blocked a JavaScript injection: ${funcName}`)
      );
    }
  });
});
