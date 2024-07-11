import * as t from "tap";
import { Agent } from "../Agent";
import { setInstance } from "../AgentSingleton";
import { ReportingAPIForTesting } from "../api/ReportingAPIForTesting";
import { type Context, getContext, runWithContext } from "../Context";
import { LoggerForTesting } from "../logger/LoggerForTesting";
import { LoggerNoop } from "../logger/LoggerNoop";
import { setUser } from "./user";

t.test("it does not set user if empty id", async (t) => {
  setInstance(
    new Agent(
      true,
      new LoggerNoop(),
      new ReportingAPIForTesting(),
      undefined,
      undefined
    )
  );

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
  setInstance(
    new Agent(
      true,
      new LoggerNoop(),
      new ReportingAPIForTesting(),
      undefined,
      undefined
    )
  );

  setUser({ id: "id" });
});

t.test("it sets user", async (t) => {
  setInstance(
    new Agent(
      true,
      new LoggerNoop(),
      new ReportingAPIForTesting(),
      undefined,
      undefined
    )
  );

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

t.test("it sets user with number as ID", async (t) => {
  setInstance(
    new Agent(
      true,
      new LoggerNoop(),
      new ReportingAPIForTesting(),
      undefined,
      undefined
    )
  );

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
    setUser({ id: 1 });
    t.same(getContext()?.user, {
      id: "1",
    });
  });
});

t.test("it sets user with name", async (t) => {
  setInstance(
    new Agent(
      true,
      new LoggerNoop(),
      new ReportingAPIForTesting(),
      undefined,
      undefined
    )
  );

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

t.test("it logs when setUser has invalid input", async () => {
  const logger = new LoggerForTesting();
  setInstance(
    new Agent(true, logger, new ReportingAPIForTesting(), undefined, undefined)
  );

  setUser(1);
  t.same(logger.getMessages(), [
    "setUser(...) expects an object with 'id' and 'name' properties, found number instead.",
  ]);
  logger.clear();

  setUser(undefined);
  t.same(logger.getMessages(), [
    "setUser(...) expects an object with 'id' and 'name' properties, found undefined instead.",
  ]);
  logger.clear();

  setUser({ id: {} });
  t.same(logger.getMessages(), [
    "setUser(...) expects an object with 'id' property of type string or number, found object instead.",
  ]);
  logger.clear();

  setUser({ id: "" });
  t.same(logger.getMessages(), [
    "setUser(...) expects an object with 'id' property non-empty string.",
  ]);
  logger.clear();

  setUser({ name: "name" });
  t.same(logger.getMessages(), [
    "setUser(...) expects an object with 'id' property.",
  ]);
  logger.clear();
});
