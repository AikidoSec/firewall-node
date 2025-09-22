import { fail, match } from "node:assert";

export function throws() {
  const args = Array.from(arguments);

  if (args.length === 0) {
    throw new TypeError("throws requires at least one argument");
  }

  if (typeof args[0] !== "function") {
    throw new TypeError("First argument to throws must be a function");
  }

  try {
    args[0]();
  } catch (err) {
    if (args.length === 2) {
      if (typeof args[1] === "string") {
        match(
          err.message ?? err.toString(),
          new RegExp(RegExp.escape(args[1]))
        );
        return err;
      }
      throw new TypeError(
        `Second argument of throws must be a string, got ${typeof args[1]}`
      );
    }

    return err;
  }

  fail("Missing expected exception");
}
