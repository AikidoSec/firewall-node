import { getInstance } from "../AgentSingleton";
import { updateContext } from "../Context";
import { ContextStorage } from "./ContextStorage";

export function markUnsafe(payload: unknown) {
  const agent = getInstance();

  if (!agent) {
    return;
  }

  const context = ContextStorage.getStore();

  if (!context) {
    logWarningMarkUnsafeWithoutContext();
    return;
  }

  try {
    const current = context.markUnsafe || [];
    const a = JSON.stringify(payload);

    if (
      !current.some((item) => {
        // JSON.stringify is used to compare objects
        // without having to copy a deep equality function
        return JSON.stringify(item) === a;
      })
    ) {
      current.push(payload);
      updateContext(context, "markUnsafe", current);
    }
  } catch (e: unknown) {
    if (e instanceof Error) {
      // eslint-disable-next-line no-console
      console.warn("markUnsafe(...) failed to serialize the payload");
    }
  }
}

let loggedWarningMarkUnsafeWithoutContext = false;

function logWarningMarkUnsafeWithoutContext() {
  if (loggedWarningMarkUnsafeWithoutContext) {
    return;
  }

  // eslint-disable-next-line no-console
  console.warn(
    "markUnsafe(...) was called without a context. The payload will not be tracked. Make sure to call markUnsafe(...) within an HTTP request. If you're using serverless functions, make sure to use the handler wrapper provided by Zen."
  );

  loggedWarningMarkUnsafeWithoutContext = true;
}
