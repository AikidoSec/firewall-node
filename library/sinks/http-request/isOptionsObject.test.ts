import * as t from "tap";
import { isOptionsObject } from "./isOptionsObject";

t.test("it works with objects", async (t) => {
  t.equal(isOptionsObject({}), true);
  t.equal(isOptionsObject({ protocol: "https:" }), true);
  t.equal(isOptionsObject({ hostname: "localhost" }), true);
  t.equal(isOptionsObject({ port: 4000 }), true);
  t.equal(isOptionsObject({ path: "/test" }), true);
  t.equal(
    isOptionsObject({
      protocol: "https:",
      hostname: "localhost",
      port: 4000,
      path: "/test",
    }),
    true
  );
});

t.test("it works with non-objects", async (t) => {
  t.equal(isOptionsObject("test"), false);
  t.equal(isOptionsObject(1), false);
  t.equal(isOptionsObject([]), false);
  t.equal(isOptionsObject(null), false);
  t.equal(isOptionsObject(undefined), false);
  t.equal(isOptionsObject(new URL("https://aikido.dev")), false);
});
