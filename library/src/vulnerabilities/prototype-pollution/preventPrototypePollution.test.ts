import * as t from "tap";
import { Agent } from "../../agent/Agent";
import { setInstance } from "../../agent/AgentSingleton";
import { APIForTesting } from "../../agent/api/APIForTesting";
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
      freezeBuiltinsIfPossible({ shimmer: "^1.0.0", notInstalled: "^1.0.0" }),
      {
        success: false,
        incompatiblePackages: { shimmer: "1.2.1" },
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
    new APIForTesting(),
    new Token("123"),
    false
  );

  setInstance(agent);
  preventPrototypePollution();
  t.same(logger.getMessages(), ["Prevented prototype pollution!"]);
});