/**
 * Grabbed from https://github.com/jonschlinkert/is-plain-object
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
  if (isObject(o) === false) return false;

  // Prototype of the instance itself (e.g. Object.prototype for `{}`)
  const objectPrototype = Object.getPrototypeOf(o);

  // Constructor found on the object's prototype chain.
  // Reading it from the prototype avoids issues when `o` has its own `constructor` key.
  const constructorFromPrototype = objectPrototype?.constructor;
  if (constructorFromPrototype === undefined) {
    return true;
  }

  // Check the constructor's prototype to distinguish plain objects from custom class instances.
  const constructorPrototype = constructorFromPrototype.prototype;
  if (isObject(constructorPrototype) === false) return false;

  // Its constructor does not have an Object-specific method
  if (
    Object.prototype.hasOwnProperty.call(
      constructorPrototype,
      "isPrototypeOf"
    ) === false
  ) {
    return false;
  }

  // Most likely a plain Object
  return true;
}
