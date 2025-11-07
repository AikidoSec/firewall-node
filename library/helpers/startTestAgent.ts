import type { ReportingAPI } from "../agent/api/ReportingAPI";
import type { Token } from "../agent/api/Token";
import { __internalRewritePackageNamesForTesting } from "../agent/hooks/instrumentation/instructions";
import { __internalRewritePackageName } from "../agent/hooks/wrapRequire";
import type { Logger } from "../agent/logger/Logger";
import { Wrapper } from "../agent/Wrapper";
import { createTestAgent } from "./createTestAgent";

type PackageName = string;
type AliasToRequire = string;

/**
 * Start a test agent for testing purposes
 */
export function startTestAgent(opts: {
  block?: boolean;
  logger?: Logger;
  api?: ReportingAPI;
  token?: Token;
  serverless?: string;
  wrappers: Wrapper[];
  rewrite: Record<PackageName, AliasToRequire>;
}) {
  const agent = createTestAgent(opts);

  if (agent.isUsingNewInstrumentation()) {
    // See explanation in comment below
    __internalRewritePackageNamesForTesting(opts.rewrite);
  }
  agent.start(opts.wrappers);

  if (!agent.isUsingNewInstrumentation()) {
    // In order to support multiple versions of the same package, we need to rewrite the package name
    // e.g. In our sources and sinks, we use the real package name `hooks.addPackage("undici")`
    // but in the tests we want to `require("undici-v6")` instead of `require("undici")`
    // The `__internalRewritePackageName` function allows us to do this
    Object.keys(opts.rewrite).forEach((packageName) => {
      __internalRewritePackageName(packageName, opts.rewrite[packageName]);
    });
  }

  return agent;
}
