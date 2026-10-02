import * as t from "tap";
import { LoggerForTesting } from "../../agent/logger/LoggerForTesting";
import {
  freezeBuiltinsIfPossible,
  preventPrototypePollution,
} from "./preventPrototypePollution";
import { createTestAgent } from "../../helpers/createTestAgent";
import * as getPackageVersionModule from "../../helpers/getPackageVersion";

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
        incompatiblePackages: { "shell-quote": "1.8.3" },
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

t.test(
  "it warns and lets agent know when an incompatible package is found",
  async (t) => {
    const originalGetPackageVersion =
      getPackageVersionModule.getPackageVersion;
    getPackageVersionModule.getPackageVersion = ((pkg: string) => {
      return pkg === "mongoose" ? "4.0.0" : originalGetPackageVersion(pkg);
    }) as typeof originalGetPackageVersion;

    const originalWarn = console.warn;
    const warnings: string[] = [];
    console.warn = (msg: string) => warnings.push(msg);

    try {
      const logger = new LoggerForTesting();
      const agent = createTestAgent({
        logger,
      });

      preventPrototypePollution();

      t.same(logger.getMessages(), [
        "Unable to prevent prototype pollution, incompatible packages found: mongoose@4.0.0",
      ]);
      t.equal(warnings.length, 1);
      t.match(warnings[0], "mongoose@4.0.0");
      t.match(warnings[0], "Zen did NOT freeze JavaScript built-ins");
    } finally {
      console.warn = originalWarn;
      getPackageVersionModule.getPackageVersion = originalGetPackageVersion;
    }
  }
);
