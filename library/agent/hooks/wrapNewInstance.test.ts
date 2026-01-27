/* eslint-disable max-classes-per-file */
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
