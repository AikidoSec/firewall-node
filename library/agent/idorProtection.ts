import { isPlainObject } from "../helpers/isPlainObject";
import { getInstance } from "./AgentSingleton";
import type { IdorProtectionConfig } from "./IdorProtectionConfig";

export function enableIdorProtection(config: {
  tenantColumnName: string;
  excludedTables?: string[];
}) {
  const agent = getInstance();

  if (!agent) {
    logWarningAgentNotStarted();
    return;
  }

  const rawConfig = config as unknown;

  if (!isPlainObject(rawConfig)) {
    agent.log(
      `enableIdorProtection(...) expects an object, found ${typeof rawConfig} instead.`
    );
    return;
  }

  if (
    !("tenantColumnName" in rawConfig) ||
    typeof rawConfig.tenantColumnName !== "string" ||
    rawConfig.tenantColumnName.length === 0
  ) {
    agent.log(
      `enableIdorProtection(...) expects a non-empty 'tenantColumnName' string property.`
    );
    return;
  }

  let excludedTables: string[] = [];
  if ("excludedTables" in rawConfig) {
    if (!Array.isArray(rawConfig.excludedTables)) {
      agent.log(
        `enableIdorProtection(...) expects 'excludedTables' to be an array of strings.`
      );
      return;
    }
    excludedTables = rawConfig.excludedTables.filter(
      (t): t is string => typeof t === "string" && t.length > 0
    );
  }

  const validatedConfig: IdorProtectionConfig = {
    tenantColumnName: rawConfig.tenantColumnName,
    excludedTables: excludedTables,
  };

  agent.setIdorProtectionConfig(validatedConfig);
}

let loggedWarning = false;

function logWarningAgentNotStarted() {
  if (loggedWarning) {
    return;
  }

  // eslint-disable-next-line no-console
  console.warn(
    "enableIdorProtection(...) was called before the Zen agent was started. Make sure to import Zen at the top of your main app file (before any other imports)."
  );

  loggedWarning = true;
}
