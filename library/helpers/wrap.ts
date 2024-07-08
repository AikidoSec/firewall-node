import { defineProperty } from "./defineProperty";
import { wrapFunction } from "./wrapFunction";

export function wrap(
  module: any,
  name: string,
  wrapper: (original: Function) => Function
) {
  if (!module[name]) {
    throw new Error(`no original function ${name} to wrap`);
  }

  if (typeof module[name] !== "function") {
    throw new Error(
      `original must be a function, instead found: ${typeof module[name]}`
    );
  }

  const original = module[name];
  const wrapped = wrapFunction(original, wrapper);

  defineProperty(module, name, wrapped);

  return wrapped;
}
