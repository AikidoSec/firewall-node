import * as t from "tap";
import type { Context } from "../Context";
import { ContextStack } from "./ContextStack";

const context: Context = {
  remoteAddress: "::1",
  method: "POST",
  url: "http://localhost:4000",
  query: {},
  headers: {},
  body: {
    myTitle: `-- should be blocked`,
  },
  cookies: {},
  routeParams: {},
  source: "express",
  route: "/posts/:id",
};

t.test("it throws error when popping from empty stack", async (t) => {
  const stack = new ContextStack(context);
  t.throws(() => stack.pop());
});
