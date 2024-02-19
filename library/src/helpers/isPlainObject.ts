/** 
 * Grabbed from https://github.com/jonschlinkert/is-plain-object
 * @module helpers/isPlainObject
 */

function isObject(o: unknown) {
  return Object.prototype.toString.call(o) === "[object Object]";
}
/**
 * This function examines an object to check if it's a plain object.
 * @param o The object you want to examine
 * @returns True when it is a plain object, otherwise false
 * @example
 * isPlainObject(Object.create({})) // Returns true
 * @example
 * isPlainObject({ foo: "bar" }) // Returns true
 * @example
 * isPlainObject(new Foo()) // Returns false
 */
export function isPlainObject(o: unknown): o is Record<string, unknown> {
  let ctor, prot;

  if (isObject(o) === false) return false;

  // It has modified constructor
  // eslint-disable-next-line prefer-const
  ctor = (o as any).constructor;
  if (ctor === undefined) return true;

  // It has modified prototype
  // eslint-disable-next-line prefer-const
  prot = ctor.prototype;
  if (isObject(prot) === false) return false;

  // Its constructor does not have an Object-specific method
  if (prot.hasOwnProperty("isPrototypeOf") === false) {
    return false;
  }

  // Most likely a plain Object
  return true;
}
