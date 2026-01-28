import { AsyncLocalStorage } from "async_hooks";

const idorIgnoredStorage = new AsyncLocalStorage<boolean>();

export function withoutIdorProtection<T>(fn: () => T): T {
  return idorIgnoredStorage.run(true, fn);
}

export function isIdorProtectionIgnored(): boolean {
  return idorIgnoredStorage.getStore() === true;
}
