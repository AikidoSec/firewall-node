import * as t from "tap";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import { Token } from "../agent/api/Token";
import { Context, runWithContext } from "../agent/Context";
import { Path } from "./Path";
import { createTestAgent } from "../helpers/createTestAgent";
import { setTimeout } from "timers/promises";

function unsafeContext(): Context {
  return {
    remoteAddress: "::1",
    method: "POST",
    url: "http://localhost:4000",
    query: {},
    headers: {},
    body: {
      file: {
        matches: "../test.txt",
      },
    },
    cookies: {},
    routeParams: {},
    source: "express",
    route: "/",
  };
}

t.test("it works", async (t) => {
  const api = new ReportingAPIForTesting();
  const agent = createTestAgent({
    block: false,
    api: api,
    token: new Token("test"),
  });

  agent.start([new Path()]);

  const { join } = require("path");

  runWithContext(unsafeContext(), () => {
    join(__dirname, "../test.txt");
  });

  await setTimeout(0);

  t.same(
    api.getEvents().filter((event) => event.type === "detected_attack").length,
    1
  );
});
