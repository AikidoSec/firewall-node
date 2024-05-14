import * as t from "tap";
import { ContextStack } from "./ContextStack";

t.test("it throws error if popping empty stack", async (t) => {
  const stack = new ContextStack([]);
  t.throws(() => stack.pop());
});
