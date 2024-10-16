/* eslint-disable max-classes-per-file */
import * as t from "tap";
import { wrapNewInstance } from "./wrapNewInstance";
import { LoggerForTesting } from "../logger/LoggerForTesting";
import { Token } from "../api/Token";
import { createTestAgent } from "../../helpers/createTestAgent";

t.test("Agent is not initialized", async (t) => {
  try {
    wrapNewInstance({}, "test", { name: "test", type: "external" }, () => {});
    t.fail();
  } catch (e) {
    t.same(e.message, "Can not wrap new instance if agent is not initialized");
  }
});

const logger = new LoggerForTesting();
const agent = createTestAgent({
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
    "Failed to wrap method test in module testmod",
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