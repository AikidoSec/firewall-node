import * as t from "tap";
import { enableIdorProtection } from "./idorProtection";
import { createTestAgent } from "../helpers/createTestAgent";
import { LoggerForTesting } from "./logger/LoggerForTesting";
import { getInstance } from "./AgentSingleton";

t.beforeEach(() => {
  createTestAgent();
});

t.test("it logs when excludedTables contains non-string values", async (t) => {
  const logger = new LoggerForTesting();
  createTestAgent({ logger });

  enableIdorProtection({
    tenantColumnName: "tenant_id",
    // @ts-expect-error Testing invalid input
    excludedTables: ["users", 123],
  });

  t.same(logger.getMessages(), [
    "enableIdorProtection(...) expects 'excludedTables' to be an array of strings.",
  ]);

  t.equal(getInstance()!.getIdorProtectionConfig(), undefined);
});
