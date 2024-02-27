import * as t from "tap";
import { Token } from "./Token";

t.test("it throws error if token is empty", async (t) => {
  t.throws(() => new Token(""));
});

t.test("it returns the token as string", async (t) => {
  const token = new Token("token");
  t.same(token.asString(), "token");
});

t.test("it throws error if toString() is called", async (t) => {
  t.throws(() => `${new Token("token")}`);
});
