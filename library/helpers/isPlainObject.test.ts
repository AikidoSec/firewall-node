import t from "tap";
import { isPlainObject } from "./isPlainObject";

t.test(
  "should return `true` if the object is created by the `Object` constructor.",
  async (t) => {
    t.ok(isPlainObject(Object.create({})));
    t.ok(isPlainObject(Object.create(Object.prototype)));
    t.ok(isPlainObject({ foo: "bar" }));
    t.ok(isPlainObject({}));
    t.ok(isPlainObject(Object.create(null)));
  }
);

t.test(
  "should return `false` if the object is not created by the `Object` constructor.",
  async (t) => {
    function Foo() {
      this.abc = {};
    }

    t.notOk(isPlainObject(/foo/));
    t.notOk(isPlainObject(function myFunc() {}));
    t.notOk(isPlainObject(1));
    t.notOk(isPlainObject(["foo", "bar"]));
    t.notOk(isPlainObject([]));
    t.notOk(isPlainObject(new Foo()));
    t.notOk(isPlainObject(null));
  }
);

t.test("should return `false` if prototype has been modified", async (t) => {
  function CustomConstructor() {}

  // Directly use a built-in type's prototype, for example, Array.prototype
  CustomConstructor.prototype = Array.prototype;

  const instance = new CustomConstructor();

  t.same(isPlainObject(instance), false);
});
