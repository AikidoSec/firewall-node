// Node.js v16 does not have structuredClone, so we need to use a polyfill
const cloneFunction =
  typeof structuredClone === "function"
    ? structuredClone
    : (obj: any) => JSON.parse(JSON.stringify(obj));

export function clone<T>(obj: T): T {
  return cloneFunction(obj);
}
