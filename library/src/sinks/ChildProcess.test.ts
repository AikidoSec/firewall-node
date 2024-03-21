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
    file: {
      matches: "`echo .`",
    },
  },
  cookies: {},
};

t.test("it works", async (t) => {
  const agent = new Agent(
    true,
    new LoggerNoop(),
    new APIForTesting(),
    undefined,
    true
  );

  agent.start([new ChildProcess()]);

  const { exec, execSync } = require("child_process");

  const runCommandsWithInvalidArgs = () => {
    const execError = t.throws(() => exec().unref());
    if (execError instanceof Error) {
      t.same(
        execError.message,
        'The "command" argument must be of type string. Received undefined'
      );
    }

    const execSyncError = t.throws(() => execSync());
    if (execSyncError instanceof Error) {
      t.same(
        execSyncError.message,
        'The "command" argument must be of type string. Received undefined'
      );
    }
  };

  runCommandsWithInvalidArgs();

  runWithContext(unsafeContext, () => {
    runCommandsWithInvalidArgs();
  });

  const runCommandsWithZSH = () => {
    exec(
      "ls `echo .`",
      { shell: "/bin/zsh" },
      (err, stdout, stderr) => {}
    ).unref();
    execSync("ls `echo .`", { shell: "/bin/zsh" }, (err, stdout, stderr) => {});
  };

  runCommandsWithZSH();

  runWithContext(unsafeContext, () => {
    runCommandsWithZSH();
  });

  const runSafeCommands = () => {
    exec("ls", (err, stdout, stderr) => {}).unref();
    exec("ls", { shell: "/bin/bash" }, (err, stdout, stderr) => {}).unref();
    execSync("ls", (err, stdout, stderr) => {});
    execSync("ls", { shell: "/bin/bash" }, (err, stdout, stderr) => {});
  };

  runSafeCommands();

  runWithContext(unsafeContext, () => {
    runSafeCommands();
  });

  runWithContext(unsafeContext, () => {
    const error1 = t.throws(() =>
      exec("ls `echo .`", (err, stdout, stderr) => {}).unref()
    );
    if (error1 instanceof Error) {
      t.same(
        error1.message,
        "Aikido runtime has blocked a Shell injection: child_process.exec(...) originating from body (.file.matches)"
      );
    }
    const error2 = t.throws(() =>
      exec(
        "ls `echo .`",
        { shell: "/bin/bash" },
        (err, stdout, stderr) => {}
      ).unref()
    );
    if (error2 instanceof Error) {
      t.same(
        error2.message,
        "Aikido runtime has blocked a Shell injection: child_process.exec(...) originating from body (.file.matches)"
      );
    }
    const error3 = t.throws(() =>
      execSync("ls `echo .`", (err, stdout, stderr) => {})
    );
    if (error3 instanceof Error) {
      t.same(
        error3.message,
        "Aikido runtime has blocked a Shell injection: child_process.execSync(...) originating from body (.file.matches)"
      );
    }
    const error4 = t.throws(() =>
      execSync(
        "ls `echo .`",
        { shell: "/bin/bash" },
        (err, stdout, stderr) => {}
      )
    );
    if (error4 instanceof Error) {
      t.same(
        error4.message,
        "Aikido runtime has blocked a Shell injection: child_process.execSync(...) originating from body (.file.matches)"
      );
    }
  });
});
