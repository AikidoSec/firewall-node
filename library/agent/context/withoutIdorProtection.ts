import { AsyncLocalStorage } from "async_hooks";

const idorIgnoredStorage = new AsyncLocalStorage<boolean>();

export function withoutIdorProtection<T>(fn: () => T): T {
  if (typeof fn !== "function") {
    // eslint-disable-next-line no-console
    console.warn(
      "Zen.withoutIdorProtection: Expected a function, but received a value. Wrap your code in a closure: () => yourCode"
    );
    return fn as unknown as T;
  }

  return idorIgnoredStorage.run(true, () => {
    const result = fn();

    // If a sync callback returns a Promise, the await happens outside the
    // AsyncLocalStorage context and IDOR protection won't be disabled.
    // Use an async callback with await to ensure the query runs inside the context.
    if (result instanceof Promise && fn.constructor.name !== "AsyncFunction") {
      // eslint-disable-next-line no-console
      console.warn(
        "Zen.withoutIdorProtection: The callback returned a Promise without awaiting it. Use an async callback: async () => { return await db.query... }"
      );
    }

    return result;
  }) as T;
}

export function isIdorProtectionIgnored(ignoreIdorContext?: boolean): boolean {
  if (typeof ignoreIdorContext === "boolean") {
    return ignoreIdorContext;
  }

  return idorIgnoredStorage.getStore() === true;
}
