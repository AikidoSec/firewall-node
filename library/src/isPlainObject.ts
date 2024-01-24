// Grabbed from https://github.com/jonschlinkert/is-plain-object

function isObject(o: unknown) {
  return Object.prototype.toString.call(o) === "[object Object]";
}

export function isPlainObject(o: unknown): o is object {
  let ctor, prot;

  if (isObject(o) === false) return false;

  // It has modified constructor
  ctor = o.constructor;
  if (ctor === undefined) return true;

  // It has modified prototype
  prot = ctor.prototype;
  if (isObject(prot) === false) return false;

  // Its constructor does not have an Object-specific method
  if (prot.hasOwnProperty("isPrototypeOf") === false) {
    return false;
  }

  // Most likely a plain Object
  return true;
}
