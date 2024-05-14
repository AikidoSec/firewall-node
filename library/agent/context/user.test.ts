import * as t from "tap";
import { type Context, runWithContext } from "../Context";
import { getUser, setUser } from "./user";

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

t.test("it does not set user if empty id", async (t) => {
  runWithContext(context, () => {
    setUser({ id: "" });
    t.same(getUser(), undefined);
  });
});

t.test("it does not set user if not inside context", async () => {
  setUser({ id: "id" });
  t.same(getUser(), undefined);
});

t.test("it sets user", async (t) => {
  runWithContext(context, () => {
    setUser({ id: "id" });
    t.same(getUser(), {
      id: "id",
    });
  });
});

t.test("it sets user with name", async (t) => {
  runWithContext(context, () => {
    setUser({ id: "id", name: "name" });
    t.same(getUser(), {
      id: "id",
      name: "name",
    });
  });
});
