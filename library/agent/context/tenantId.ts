import { getInstance } from "../AgentSingleton";
import { ContextStorage } from "./ContextStorage";

export function setTenantId(id: string | number) {
  const agent = getInstance();

  if (!agent) {
    return;
  }

  const context = ContextStorage.getStore();
  if (!context) {
    logWarningSetTenantIdCalledWithoutContext();
    return;
  }

  const rawId = id as unknown;

  if (typeof rawId !== "string" && typeof rawId !== "number") {
    agent.log(
      `setTenantId(...) expects a string or number, found ${typeof rawId} instead.`
    );
    return;
  }

  if (typeof rawId === "string" && rawId.length === 0) {
    agent.log(`setTenantId(...) expects a non-empty string.`);
    return;
  }

  context.tenantId = rawId.toString();
}

let loggedWarning = false;

function logWarningSetTenantIdCalledWithoutContext() {
  if (loggedWarning) {
    return;
  }

  // eslint-disable-next-line no-console
  console.warn(
    "setTenantId(...) was called without a context. Make sure to call setTenantId(...) within an HTTP request. If you're using serverless functions, make sure to use the handler wrapper provided by Zen. Also ensure you import Zen at the top of your main app file (before any other imports)."
  );

  loggedWarning = true;
}
