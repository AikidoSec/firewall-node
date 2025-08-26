import * as t from "tap";
import { isWrapped, wrap } from "./wrap";

class MyClass {
  abc = "abc";

  aMethod() {
    return "aMethod";
  }
}

t.test(
  "it throws error if there is no property with specified name",
  async (t) => {
    t.throws(() => {
      wrap(MyClass.prototype, "nonExistentMethod", function wrap() {
        return function wrap() {
          return "wrapped";
        };
      });
    });
  }
);

t.test("it throws error if the property is not a function", async (t) => {
  t.throws(() => {
    wrap(new MyClass(), "abc", function wrap(original) {
      return function wrap() {
        return "wrapped";
      };
    });
  });
});

t.test("it wraps a method", async (t) => {
  wrap(MyClass.prototype, "aMethod", function wrap(original) {
    return function wrap() {
      return "wrapped";
    };
  });

  const myClass = new MyClass();
  t.same(myClass.aMethod(), "wrapped");
});

t.test("isWrapped returns true for wrapped function", async (t) => {
  const myClass = new MyClass();
  t.same(isWrapped(myClass.aMethod), true);
});

t.test("it returns false for unwrapped function or property", async (t) => {
  const myClass = new MyClass();
  t.same(isWrapped(myClass.abc), false);

  const test = () => "test";
  t.same(isWrapped(test), false);
});

t.test("it preserves the original function's properties", async (t) => {
  const originalFunction = function original() {};
  originalFunction.someProperty = "someValue";

  const moduleObj = { myMethod: originalFunction };
  Object.defineProperty(moduleObj, "getterAndSetter", {
    get: () => () => "42",
    set: () => {
      return 0;
    },
    configurable: true,
    enumerable: true,
  });

  Object.defineProperty(moduleObj, "nonEnumerable", {
    configurable: true,
    enumerable: false,
    value: () => "nonEnumerable",
  });

  wrap(moduleObj, "myMethod", (original) => {
    return function wrapped() {
      return original();
    };
  });

  wrap(moduleObj, "getterAndSetter", (original) => {
    return function wrapped() {
      return "Zen";
    };
  });

  wrap(moduleObj, "nonEnumerable", (original) => {
    return function wrapped() {
      return "Zen";
    };
  });

  t.same(isWrapped(moduleObj.myMethod), true);
  t.same(moduleObj.myMethod.someProperty, "someValue");
  // @ts-expect-error Defined by Zen
  t.same(moduleObj.myMethod.__original, originalFunction);
  // @ts-expect-error Defined by Zen
  t.same(moduleObj.myMethod.__wrapped, true);

  // @ts-expect-error Not auto detected by TypeScript
  t.same(moduleObj.getterAndSetter(), "Zen");
  // @ts-expect-error Not auto detected by TypeScript
  t.same(moduleObj.getterAndSetter.__original(), "42");
  // @ts-expect-error Not auto detected by TypeScript
  t.same(moduleObj.getterAndSetter.__wrapped, true);
  t.same(
    Object.getOwnPropertyDescriptor(moduleObj, "getterAndSetter")!.enumerable,
    true
  );

  // @ts-expect-error Not auto detected by TypeScript
  t.same(moduleObj.nonEnumerable(), "Zen");
  // @ts-expect-error Not auto detected by TypeScript
  t.same(moduleObj.nonEnumerable.__original(), "nonEnumerable");
  // @ts-expect-error Not auto detected by TypeScript
  t.same(moduleObj.nonEnumerable.__wrapped, true);
  t.same(
    Object.getOwnPropertyDescriptor(moduleObj, "nonEnumerable")!.enumerable,
    false
  );
});
