import * as t from "tap";
import { wrapNewInstance } from "./wrapNewInstance";
import { Agent } from "../Agent";
import { LoggerForTesting } from "../logger/LoggerForTesting";
import { Token } from "../api/Token";
import { ReportingAPIForTesting } from "../api/ReportingAPIForTesting";
import { setInstance } from "../AgentSingleton";

t.test("Agent is not initialized", async (t) => {
  try {
    wrapNewInstance({}, "test", { name: "test", type: "external" }, () => {});
    t.fail();
  } catch (e) {
    t.same(e.message, "Can not wrap new instance if agent is not initialized");
  }
});

const logger = new LoggerForTesting();
const agent = new Agent(
  true,
  logger,
  new ReportingAPIForTesting(),
  new Token("123"),
  undefined
);
setInstance(agent);

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
