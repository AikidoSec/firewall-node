import { ContextStorage } from "./ContextStorage";

/**
 * Calling this function disables Zen for the remaning duration of the request.
 */
export function bypassRequest(): void {
  const context = ContextStorage.getStore();
  if (!context) {
    logWarningBypassRequestCalledWithoutContext();
    return;
  }

  context.bypassRequest = true;
}

let loggedNoContextWarning = false;

function logWarningBypassRequestCalledWithoutContext() {
  if (loggedNoContextWarning) {
    return;
  }

  // oxlint-disable-next-line no-console
  console.warn(
    "bypassRequest(...) was called without a context. The request will not be bypassed. Make sure to call bypassRequest(...) within an HTTP request. If you're using serverless functions, make sure to use the handler wrapper provided by Zen. Also ensure you import Zen at the top of your main app file (before any other imports)."
  );

  loggedNoContextWarning = true;
}
