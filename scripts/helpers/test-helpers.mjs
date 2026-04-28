import assert from "node:assert";

export function throws(...args) {
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
        assert.match(
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

  assert.fail("Missing expected exception");
}

export function match(actual, expected, message) {
  if (typeof expected === "string") {
    expected = new RegExp(RegExp.escape(expected));
  }

  if (expected instanceof RegExp) {
    if (typeof actual !== "string") {
      actual = String(actual);
    }

    assert.match(actual, expected, message);
    return;
  }

  assert.partialDeepStrictEqual(actual, expected, message);
}

function toPlainObject(value) {
  if (value && typeof value === "object") {
    return JSON.parse(JSON.stringify(value));
  }
  return value;
}

export function same(actual, expected, message) {
  assert.deepStrictEqual(
    toPlainObject(actual),
    toPlainObject(expected),
    message
  );
}

export function pass(message) {
  assert.ok(true, message);
}

export function rejects(...args) {
  if (args.length === 0) {
    throw new TypeError("rejects requires at least one argument");
  }

  let promise;
  if (args[0] instanceof Promise) {
    promise = args[0];
  } else if (typeof args[0] === "function") {
    try {
      promise = args[0]();
    } catch (err) {
      // If the function throws synchronously, treat as rejection
      return Promise.resolve(err);
    }
    if (!(promise instanceof Promise)) {
      throw new TypeError("Async function must return a Promise");
    }
  } else {
    throw new TypeError(
      "First argument to rejects must be a Promise or async function"
    );
  }

  return new Promise((resolve, reject) => {
    promise
      .then(() => {
        reject(new Error("Missing expected rejection"));
      })
      .catch((err) => {
        if (args.length === 1) {
          return resolve(err);
        }
        if (
          typeof args[1] === "object" &&
          args[1] !== null &&
          "message" in args[1]
        ) {
          match(err.message ?? err.toString(), args[1].message);
          return resolve(err);
        }

        throw new TypeError(
          `Second argument of rejects must be an object with a message property, got ${typeof args[1]}`
        );
      });
  });
}

export function notMatch(actual, expected, message) {
  if (typeof expected === "string") {
    expected = new RegExp(RegExp.escape(expected));
  }

  if (expected instanceof RegExp) {
    if (typeof actual !== "string") {
      actual = String(actual);
    }

    assert.doesNotMatch(actual, expected, message);
    return;
  }

  try {
    assert.partialDeepStrictEqual(actual, expected);
  } catch {
    // If they are not deeply equal, the assertion will throw, which means the test should pass
    return;
  }

  assert.fail(message || "Values are deeply equal");
}
