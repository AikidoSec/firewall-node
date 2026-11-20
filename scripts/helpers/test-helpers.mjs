import assert from "node:assert";
import * as runner from "node:test";
import { AsyncLocalStorage } from "node:async_hooks";

export { assert };
const currentTest = new AsyncLocalStorage();

export function test(name, options, callback) {
  if (typeof options === "function") {
    callback = options;
    options = {};
  }
  const parent = currentTest.getStore();
  const register = parent
    ? parent.context.test.bind(parent.context)
    : runner.test;
  const pending = register(name, options, async (context) => {
    const state = { context, pending: [] };
    const finished = new Promise((resolve) => {
      state.finish = resolve;
    });
    await currentTest.run(state, async () => {
      const result = callback(context);
      if (result && typeof result.then === "function") await result;
      else if (callback.length > 0) await finished;
      await Promise.all(state.pending);
    });
  });
  parent?.pending.push(pending);
  return pending;
}

export function end() {
  currentTest.getStore().finish();
}

export function teardown(callback) {
  const context = currentTest.getStore()?.context;
  return context ? context.after(callback) : runner.after(callback);
}

export function before(callback) {
  const context = currentTest.getStore()?.context;
  return context ? context.before(callback) : runner.before(callback);
}

export function beforeEach(callback) {
  const context = currentTest.getStore()?.context;
  return context ? context.beforeEach(callback) : runner.beforeEach(callback);
}

export function after(callback) {
  return teardown(callback);
}

export function afterEach(callback) {
  const context = currentTest.getStore()?.context;
  return context ? context.afterEach(callback) : runner.afterEach(callback);
}

export function skip(name) {
  return test(name, { skip: true }, () => {});
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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
          new RegExp(escapeRegExp(args[1]))
        );
        return err;
      }

      if (args[1] instanceof RegExp) {
        assert.match(err.message ?? err.toString(), args[1]);
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

function optionalMessage(message) {
  return message === undefined ? [] : [message];
}

export function match(actual, expected, message) {
  if (typeof expected === "string") {
    expected = new RegExp(escapeRegExp(expected));
  }

  if (expected instanceof RegExp) {
    if (typeof actual !== "string") {
      actual = String(actual);
    }

    assert.match(actual, expected, ...optionalMessage(message));
    return;
  }

  assert.partialDeepStrictEqual(actual, expected, ...optionalMessage(message));
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
    ...optionalMessage(message)
  );
}

export function pass(message) {
  assert.ok(true, ...optionalMessage(message));
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

  const pending = new Promise((resolve, reject) => {
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
          try {
            match(err.message ?? err.toString(), args[1].message);
            return resolve(err);
          } catch (error) {
            return reject(error);
          }
        }

        reject(
          new TypeError(
            `Second argument of rejects must be an object with a message property, got ${typeof args[1]}`
          )
        );
      });
  });
  currentTest.getStore()?.pending.push(pending);
  return pending;
}

export function notMatch(actual, expected, message) {
  if (typeof expected === "string") {
    expected = new RegExp(escapeRegExp(expected));
  }

  if (expected instanceof RegExp) {
    if (typeof actual !== "string") {
      actual = String(actual);
    }

    assert.doesNotMatch(actual, expected, ...optionalMessage(message));
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
