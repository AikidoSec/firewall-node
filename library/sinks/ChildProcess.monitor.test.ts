import * as t from "tap";
import { Context, runWithContext } from "../agent/Context";
import { ChildProcess } from "./ChildProcess";
import { execFile, execFileSync } from "child_process";
import { createTestAgent } from "../helpers/createTestAgent";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import * as FakeTimers from "@sinonjs/fake-timers";
import { Token } from "../agent/api/Token";

const unsafeContext: Context = {
  remoteAddress: "::1",
  method: "POST",
  url: "http://localhost:4000",
  query: {},
  headers: {},
  body: {
    file: {
      matches: "`echo .`",
    },
  },
  cookies: {},
  routeParams: {},
  source: "express",
  route: "/posts/:id",
};

t.test("it does not report the attack twice", async (t) => {
  const clock = FakeTimers.install();

  const api = new ReportingAPIForTesting();
  const agent = createTestAgent({
    block: false,
    api: api,
    token: new Token("test"),
  });

  agent.start([new ChildProcess()]);

  const { exec } = require("child_process") as typeof import("child_process");

  runWithContext(unsafeContext, () => {
    exec("ls `echo .`", (err, stdout, stderr) => {}).unref();
  });

  clock.tick(60 * 1000);

  const attacks = api.getEvents().filter((e) => e.type === "detected_attack");

  t.match(attacks, [
    {
      type: "detected_attack",
      attack: {
        module: "child_process",
        operation: "child_process.execFile",
      },
    },
  ]);

  t.same(attacks.length, 1);

  clock.uninstall();
});
