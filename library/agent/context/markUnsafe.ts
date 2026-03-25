/* oxlint-disable no-console */

import { isPlainObject } from "../../helpers/isPlainObject";
import { getInstance } from "../AgentSingleton";
import { Context, updateContext } from "../Context";
import { ContextStorage } from "./ContextStorage";

export function markUnsafe(...data: unknown[]) {
  const agent = getInstance();

  if (!agent) {
    return;
  }

  const context = ContextStorage.getStore();

  if (!context) {
    logWarningMarkUnsafeWithoutContext();
    return;
  }

  if (data.length === 0) {
    console.warn("markUnsafe(...) was called without any data.");
  }

  for (const item of data) {
    if (
      !isPlainObject(item) &&
      !Array.isArray(item) &&
      typeof item !== "string"
    ) {
      const type = item === null ? "null" : typeof item;
      console.warn(
        `markUnsafe(...) expects an object, array, or string. Received: ${type}`
      );
      continue;
    }

    addPayloadToContext(context, item);
  }
}

function addPayloadToContext(context: Context, payload: unknown) {
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
      console.warn("markUnsafe(...) failed to serialize the data");
    }
  }
}

let loggedWarningMarkUnsafeWithoutContext = false;

function logWarningMarkUnsafeWithoutContext() {
  if (loggedWarningMarkUnsafeWithoutContext) {
    return;
  }

  console.warn(
    "markUnsafe(...) was called without a context. The data will not be tracked. Make sure to call markUnsafe(...) within an HTTP request. If you're using serverless functions, make sure to use the handler wrapper provided by Zen. Also ensure you import Zen at the top of your main app file (before any other imports)."
  );

  loggedWarningMarkUnsafeWithoutContext = true;
}
