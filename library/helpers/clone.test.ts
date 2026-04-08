import * as t from "tap";
import { clone } from "./clone";

t.test("it clones objects", async (t) => {
  const obj = { a: 1, b: { c: 2 } };
  const cloned = clone(obj);
  t.equal(cloned.a, 1);
  t.equal(cloned.b.c, 2);

  // Modifying the cloned object should not affect the original
  cloned.b.c = 3;
  t.equal(obj.b.c, 2);

  // Modifing the original object should not affect the cloned
  obj.b.c = 4;
  t.equal(cloned.b.c, 3);
});
