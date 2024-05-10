import * as t from "tap";
import { Agent } from "../../agent/Agent";
import { setInstance } from "../../agent/AgentSingleton";
import { ReportingAPIForTesting } from "../../agent/api/ReportingAPIForTesting";
import { Token } from "../../agent/api/Token";
import { LoggerForTesting } from "../../agent/logger/LoggerForTesting";
import {
  freezeBuiltinsIfPossible,
  preventPrototypePollution,
} from "./preventPrototypePollution";

t.test(
  "it does not freeze builtins if incompatible package is found",
  async (t) => {
    t.same(
      freezeBuiltinsIfPossible({
        "shell-quote": "^1.0.0",
        notInstalled: "^1.0.0",
      }),
      {
        success: false,
        incompatiblePackages: { "shell-quote": "1.8.1" },
      }
    );
  }
);

t.test("it freezes builtins", async (t) => {
  Object.prototype.toString = () => "foo";

  t.same(freezeBuiltinsIfPossible({}), { success: true });

  t.throws(() => {
    Object.prototype.toString = () => "bar";
  });
});

t.test("without agent instance", async () => {
  preventPrototypePollution();
});

t.test("it lets agent know", async () => {
  const logger = new LoggerForTesting();
  const agent = new Agent(
    true,
    logger,
    new ReportingAPIForTesting(),
    new Token("123"),
    undefined
  );

  setInstance(agent);
  preventPrototypePollution();
  t.same(logger.getMessages(), ["Prevented prototype pollution!"]);
});
