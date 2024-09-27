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
