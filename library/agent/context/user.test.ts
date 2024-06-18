import * as t from "tap";
import { type Context, getContext, runWithContext } from "../Context";
import { setUser } from "./user";

t.test("it does not set user if empty id", async (t) => {
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

  runWithContext(context, () => {
    setUser({ id: "" });
    t.same(getContext()?.user, undefined);
  });
});

t.test("it does not set user if not inside context", async () => {
  setUser({ id: "id" });
});

t.test("it sets user", async (t) => {
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

  runWithContext(context, () => {
    setUser({ id: "id" });
    t.same(getContext()?.user, {
      id: "id",
    });
  });
});

t.test("it sets user with name", async (t) => {
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

  runWithContext(context, () => {
    setUser({ id: "id", name: "name" });
    t.same(getContext()?.user, {
      id: "id",
      name: "name",
    });
  });
});
