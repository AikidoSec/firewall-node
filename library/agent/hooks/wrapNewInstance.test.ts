import * as t from "tap";
import { wrapNewInstance } from "./wrapNewInstance";
import { LoggerForTesting } from "../logger/LoggerForTesting";
import { Token } from "../api/Token";
import { createTestAgent } from "../../helpers/createTestAgent";

const logger = new LoggerForTesting();

createTestAgent({
  logger,
  token: new Token("123"),
});

t.test("Inspect args", async (t) => {
  const exports = {
    test: class Test {
      constructor(private input: string) {}

      getInput() {
        return this.input;
      }
    },
  };

  wrapNewInstance(
    exports,
    "test",
    { name: "test", type: "external" },
    (exports) => {
      exports.testMethod = function test() {
        return "aikido";
      };
    }
  );

  const instance = new exports.test("input");
  t.same(instance.getInput(), "input");
  // @ts-expect-error Test method is added by interceptor
  t.same(instance.testMethod(), "aikido");
});

t.test("Wrap non existing class", async (t) => {
  const exports = {};

  wrapNewInstance(
    exports,
    "test",
    { name: "testmod", type: "external" },
    () => {}
  );

  t.same(logger.getMessages(), [
    "Failed to wrap method test in module testmod: no original function test to wrap",
  ]);
});

t.test("Does not double wrap the same class", async (t) => {
  let firstCalls = 0;
  let secondCalls = 0;
  const exports = {
    test: class Test {
      constructor(private input: string) {}

      getInput() {
        return this.input;
      }
    },
  };

  const wrapped1 = wrapNewInstance(
    exports,
    "test",
    { name: "test", type: "external" },
    () => {
      firstCalls++;
    }
  );

  const wrapped2 = wrapNewInstance(
    exports,
    "test",
    { name: "test", type: "external" },
    () => {
      secondCalls++;
    }
  );

  t.equal(wrapped1, wrapped2);
  t.equal(exports.test, wrapped1);

  new exports.test("input");

  t.same(firstCalls, 1);
  t.same(secondCalls, 0);
});

t.test("Does not double wrap an already wrapped default export", async (t) => {
  let calls = 0;
  let testExport = class Test {
    constructor(private input: string) {}

    getInput() {
      return this.input;
    }
  };

  testExport = wrapNewInstance(
    testExport,
    undefined,
    { name: "test", type: "external" },
    () => {
      calls++;
    }
  ) as any;

  testExport = wrapNewInstance(
    testExport,
    undefined,
    { name: "test", type: "external" },
    () => {
      calls += 100;
    }
  ) as any;

  new testExport("input");
  t.same(calls, 1);
});

t.test("Wraps a class that extends an already wrapped class", async (t) => {
  let baseCalls = 0;
  let subCalls = 0;

  const exports: any = {
    Base: class Base {
      constructor(private input: string) {}

      getInput() {
        return this.input;
      }
    },
  };

  wrapNewInstance(exports, "Base", { name: "test", type: "external" }, () => {
    baseCalls++;
  });

  exports.Sub = class Sub extends exports.Base {};
  const originalSub = exports.Sub;

  const wrappedSub = wrapNewInstance(
    exports,
    "Sub",
    { name: "test", type: "external" },
    () => {
      subCalls++;
    }
  );

  t.equal(wrappedSub === originalSub, false);

  new exports.Sub("input");

  t.same(subCalls, 1);
  t.same(baseCalls, 1);
});

t.test("Can wrap default export", async (t) => {
  let testExport = class Test {
    constructor(private input: string) {}

    getInput() {
      return this.input;
    }
  };

  testExport = wrapNewInstance(
    testExport,
    undefined,
    { name: "test", type: "external" },
    (exports) => {
      exports.testMethod = function test() {
        return "aikido";
      };
    }
  ) as any;

  const instance = new testExport("input");
  t.same(instance.getInput(), "input");
  // @ts-expect-error Test method is added by interceptor
  t.same(instance.testMethod(), "aikido");
});

t.test("Errors in interceptor are caught", async (t) => {
  const exports = {
    test: class Test {
      constructor(private input: string) {}

      getInput() {
        return this.input;
      }
    },
  };

  logger.clear();

  wrapNewInstance(exports, "test", { name: "test", type: "external" }, () => {
    throw new Error("test error");
  });

  const instance = new exports.test("input");
  t.same(instance.getInput(), "input");
  t.same(logger.getMessages(), [
    "Failed to wrap method test in module test: test error",
  ]);
});

t.test("Return value from interceptor is returned", async (t) => {
  const exports = {
    test: class Test {
      constructor(private input: string) {}

      getInput() {
        return this.input;
      }
    },
  };

  wrapNewInstance(exports, "test", { name: "test", type: "external" }, () => {
    return { testMethod: () => "aikido" };
  });

  const instance = new exports.test("input");
  t.same(typeof instance.getInput, "undefined");
  // @ts-expect-error Test method is added by interceptor
  t.same(instance.testMethod(), "aikido");
});

t.test("Logs error when wrapping default export", async (t) => {
  let exports = class Test {
    constructor(private input: string) {}

    getInput() {
      return this.input;
    }
  };

  logger.clear();

  exports = wrapNewInstance(
    exports,
    undefined,
    { name: "test", type: "external" },
    () => {
      throw new Error("test error");
    }
  ) as any;

  const instance = new exports("input");
  t.same(instance.getInput(), "input");
  t.same(logger.getMessages(), [
    "Failed to wrap method default export in module test: test error",
  ]);
});
