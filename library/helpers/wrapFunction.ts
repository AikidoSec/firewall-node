import { defineProperty } from "./defineProperty";

export function wrapFunction(
  original: Function,
  wrapper: (original: Function) => Function
): Function {
  const wrapped = wrapper(original);

  defineProperty(wrapped, "__original", original);
  defineProperty(wrapped, "__wrapped", true);

  // Copy over all properties from the original function to the wrapped one.
  for (const prop in original) {
    if (original.hasOwnProperty(prop)) {
      defineProperty(wrapped, prop, original[prop as keyof Function]);
    }
  }

  return wrapped;
}
