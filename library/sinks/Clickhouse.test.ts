import * as t from "tap";
import { Agent } from "../agent/Agent";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import { getContext, runWithContext, type Context } from "../agent/Context";
import { LoggerNoop } from "../agent/logger/LoggerNoop";
import { Clickhouse } from "./Clickhouse";
import { MySQL } from "./MySQL";
import type { Connection } from "mysql";

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

t.test("it detects SQL injections", async () => {
  const agent = new Agent(
    true,
    new LoggerNoop(),
    new ReportingAPIForTesting(),
    undefined,
    "lambda"
  );
  agent.start([new Clickhouse()]);

  const { createClient } = require("@clickhouse/client");

  const client = createClient({
    url: "http://localhost:8123",
    username: "root",
    password: "password",
  });

  console.log(client);

  await client.close();
});
