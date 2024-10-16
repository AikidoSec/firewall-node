import * as t from "tap";
import { LoggerForTesting } from "../../agent/logger/LoggerForTesting";
import {
  freezeBuiltinsIfPossible,
  preventPrototypePollution,
} from "./preventPrototypePollution";
import { createTestAgent } from "../../helpers/createTestAgent";

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
  const agent = createTestAgent({
    logger,
  });

  preventPrototypePollution();
  t.same(logger.getMessages(), ["Prevented prototype pollution!"]);
});
