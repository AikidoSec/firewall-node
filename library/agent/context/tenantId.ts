import { AsyncLocalStorage } from "async_hooks";
import { getInstance } from "../AgentSingleton";
import { ContextStorage } from "./ContextStorage";

export type TenantContext = { tenantId: string };

// Separate from the request Context so the tenant can be set on the request path
// (setTenantId) or re-stamped inside background work (runWithTenant) without
// touching the live request context.
const tenantIdStorage = new AsyncLocalStorage<TenantContext>();

export function getTenantContext(): TenantContext | undefined {
  // A tenant set via runWithTenant(...) takes precedence: background work can
  // re-stamp the tenant even when it resumes inside another request's context.
  const scoped = tenantIdStorage.getStore();
  if (scoped) {
    return scoped;
  }

  // Otherwise use the tenant set on the request context via setTenantId(...).
  const context = ContextStorage.getStore();
  if (context?.tenantId !== undefined) {
    return { tenantId: context.tenantId };
  }

  return undefined;
}

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

// For deferred / background work (queues, schedulers, workers) that runs outside
// the originating HTTP request. The tenant travels with the callback across async
// boundaries, so SQL executed inside is checked against it.
export function runWithTenant<T>(tenantId: string | number, fn: () => T): T {
  if (typeof fn !== "function") {
    // eslint-disable-next-line no-console
    console.warn(
      "Zen.runWithTenant: Expected a function, but received a value. Wrap your code in a closure: () => yourCode"
    );
    return fn as unknown as T;
  }

  const rawId = tenantId as unknown;

  if (
    (typeof rawId !== "string" && typeof rawId !== "number") ||
    (typeof rawId === "string" && rawId.length === 0)
  ) {
    // eslint-disable-next-line no-console
    console.warn(
      "Zen.runWithTenant(...) expects a non-empty string or number as the tenant ID. Running the callback without a tenant."
    );
    return fn();
  }

  return tenantIdStorage.run({ tenantId: rawId.toString() }, () => {
    const result = fn();

    // If a sync callback returns a Promise, the await happens outside the
    // AsyncLocalStorage context and the tenant won't be set for the query.
    // Use an async callback with await to ensure the query runs inside the context.
    if (result instanceof Promise && fn.constructor.name !== "AsyncFunction") {
      // eslint-disable-next-line no-console
      console.warn(
        "Zen.runWithTenant: The callback returned a Promise without awaiting it. Use an async callback: async () => { return await db.query... }"
      );
    }

    return result;
  });
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
