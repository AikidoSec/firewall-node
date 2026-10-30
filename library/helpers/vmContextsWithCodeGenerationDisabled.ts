import { AsyncLocalStorage } from "async_hooks";

// Not a symbol on the context object because sandboxed code could just delete the marker.
const contextsWithCodeGenDisabled = new WeakSet<object>();

export function markContextDisabled(contextObject: unknown) {
  if (typeof contextObject === "object" && contextObject !== null) {
    contextsWithCodeGenDisabled.add(contextObject);
  }
}

export function isContextDisabled(contextObject: unknown): boolean {
  return (
    typeof contextObject === "object" &&
    contextObject !== null &&
    contextsWithCodeGenDisabled.has(contextObject)
  );
}

// Needed for vm functions that create the context object themselves
// Can't be used in other cases because context is created in a different call stack
const codeGenDisabledForCall = new AsyncLocalStorage<true>();

export function runWithCodeGenDisabled<T>(disabled: boolean, fn: () => T): T {
  if (!disabled) {
    return fn();
  }

  return codeGenDisabledForCall.run(true, fn);
}

export function isCodeGenDisabledForCall(): boolean {
  return codeGenDisabledForCall.getStore() === true;
}
