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
    file: {
      matches: "`echo .`",
    },
  },
  cookies: {},
  routeParams: {},
  source: "express",
};

function throws(fn: () => void, wanted: string | RegExp) {
  const error = t.throws(fn);
  if (error instanceof Error) {
    t.match(error.message, wanted);
  }
}

t.test("it works", async (t) => {
  const agent = new Agent(
    true,
    new LoggerNoop(),
    new APIForTesting(),
    undefined,
    "lambda"
  );

  agent.start([new ChildProcess()]);

  const { exec, execSync, spawn, spawnSync } = require("child_process");

  const runCommandsWithInvalidArgs = () => {
    throws(
      () => exec().unref(),
      /argument must be of type string. Received undefined/
    );

    throws(
      () => execSync(),
      /argument must be of type string. Received undefined/
    );

    throws(
      () => spawn().unref(),
      /argument must be of type string. Received undefined/
    );

    throws(
      () => spawnSync(),
      /argument must be of type string. Received undefined/
    );
  };

  runCommandsWithInvalidArgs();

  runWithContext(unsafeContext, () => {
    runCommandsWithInvalidArgs();
  });

  const runSafeCommands = () => {
    exec("ls", (err, stdout, stderr) => {}).unref();
    execSync("ls", (err, stdout, stderr) => {});

    spawn("ls", ["-la"], {}, (err, stdout, stderr) => {}).unref();
    spawnSync("ls", ["-la"], {}, (err, stdout, stderr) => {});

    spawn("ls", ["-la"], { shell: false }, (err, stdout, stderr) => {}).unref();
    spawnSync("ls", ["-la"], { shell: false }, (err, stdout, stderr) => {});
  };

  runSafeCommands();

  runWithContext(unsafeContext, () => {
    runSafeCommands();
  });

  runWithContext(unsafeContext, () => {
    throws(
      () => exec("ls `echo .`", (err, stdout, stderr) => {}).unref(),
      "Aikido runtime has blocked a Shell injection: child_process.exec(...) originating from body.file.matches"
    );

    throws(
      () => execSync("ls `echo .`", (err, stdout, stderr) => {}),
      "Aikido runtime has blocked a Shell injection: child_process.execSync(...) originating from body.file.matches"
    );
  });

  runWithContext(unsafeContext, () => {
    throws(
      () =>
        spawn(
          "ls `echo .`",
          [],
          { shell: true },
          (err, stdout, stderr) => {}
        ).unref(),
      "Aikido runtime has blocked a Shell injection: child_process.spawn(...) originating from body.file.matches"
    );

    throws(
      () =>
        spawn(
          "ls `echo .`",
          [],
          { shell: "/bin/sh" },
          (err, stdout, stderr) => {}
        ).unref(),
      "Aikido runtime has blocked a Shell injection: child_process.spawn(...) originating from body.file.matches"
    );

    throws(
      () =>
        spawnSync(
          "ls `echo .`",
          [],
          { shell: true },
          (err, stdout, stderr) => {}
        ),
      "Aikido runtime has blocked a Shell injection: child_process.spawnSync(...) originating from body.file.matches"
    );

    throws(
      () =>
        spawnSync(
          "ls `echo .`",
          [],
          { shell: "/bin/sh" },
          (err, stdout, stderr) => {}
        ),
      "Aikido runtime has blocked a Shell injection: child_process.spawnSync(...) originating from body.file.matches"
    );
  });
});
