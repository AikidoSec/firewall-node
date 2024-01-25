// Grabbed from https://github.com/jonschlinkert/is-plain-object

function isObject(o: unknown) {
  return Object.prototype.toString.call(o) === "[object Object]";
}

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
