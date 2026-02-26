// Object.hasOwn is available since Node 16.
// See https://github.com/microsoft/TypeScript/issues/44253
interface ObjectConstructor {
  hasOwn<K extends PropertyKey, T extends object>(
    o: T,
    v: K
  ): K extends keyof T ? true : false;
  hasOwn<T extends object>(o: T, v: keyof T): true;
}
