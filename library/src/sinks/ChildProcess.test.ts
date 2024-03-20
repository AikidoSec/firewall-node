import { exec, execSync } from "child_process";
import * as t from "tap";
import { Agent } from "../agent/Agent";
import { APIForTesting } from "../agent/api/APIForTesting";
import { Context, runWithContext } from "../agent/Context";
import { LoggerNoop } from "../agent/logger/LoggerNoop";
import { ChildProcess } from "./ChildProcess";

const unsafeContext: Context = {
  remoteAddress: "::1",
  method: "POST",
  url: "http://localhost:4000",
  query: {},
  headers: {},
  body: {
    myTitle: {
      $ne: null,
    },
  },
  cookies: {},
};

t.test("it blocks shell injection", async (t) => {
  const agent = new Agent(
    true,
    new LoggerNoop(),
    new APIForTesting(),
    undefined,
    true
  );

  agent.start([new ChildProcess()]);

  const { exec, execSync } = require("child_process");

  exec("ls", (err, stdout, stderr) => {}).unref();
  exec("ls", { shell: "/bin/bash" }, (err, stdout, stderr) => {}).unref();
  execSync("ls", (err, stdout, stderr) => {});
  execSync("ls", { shell: "/bin/bash" }, (err, stdout, stderr) => {});

  runWithContext(unsafeContext, () => {
    exec("ls", (err, stdout, stderr) => {}).unref();
    exec("ls", { shell: "/bin/bash" }, (err, stdout, stderr) => {}).unref();
    execSync("ls", (err, stdout, stderr) => {});
    execSync("ls", { shell: "/bin/bash" }, (err, stdout, stderr) => {});
  });
});
