import { exec, execSync } from "child_process";
import * as t from "tap";
import { Agent } from "../agent/Agent";
import { APIForTesting } from "../agent/api/APIForTesting";
import { Context, getContext, runWithContext } from "../agent/Context";
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

t.test("it ignores calls without args", async (t) => {
  const agent = new Agent(
    true,
    new LoggerNoop(),
    new APIForTesting(),
    undefined,
    true
  );

  agent.start([new ChildProcess()]);

  runWithContext(unsafeContext, () => {
    // @ts-expect-error We're calling the method without arguments
    const execError = t.throws(() => exec().unref());
    if (execError instanceof Error) {
      t.same(
        execError.message,
        'The "command" argument must be of type string. Received undefined'
      );
    }

    // @ts-expect-error We're calling the method without arguments
    const execSyncError = t.throws(() => execSync());
    if (execSyncError instanceof Error) {
      t.same(
        execSyncError.message,
        'The "command" argument must be of type string. Received undefined'
      );
    }
  });
});

t.test("it allows safe commands", async (t) => {
  const agent = new Agent(
    true,
    new LoggerNoop(),
    new APIForTesting(),
    undefined,
    true
  );

  agent.start([new ChildProcess()]);

  const { exec, execSync } = require("child_process");

  const runCommands = () => {
    exec("ls", (err, stdout, stderr) => {}).unref();
    exec("ls", { shell: "/bin/bash" }, (err, stdout, stderr) => {}).unref();
    execSync("ls", (err, stdout, stderr) => {});
    execSync("ls", { shell: "/bin/bash" }, (err, stdout, stderr) => {});
  };

  runCommands();

  runWithContext(unsafeContext, () => {
    runCommands();
  });
});

t.test("it does nothing if shell is not /bin/bash or /bin/sh", async (t) => {
  const agent = new Agent(
    true,
    new LoggerNoop(),
    new APIForTesting(),
    undefined,
    true
  );

  agent.start([new ChildProcess()]);

  const { exec, execSync } = require("child_process");

  const runCommands = () => {
    exec(
      "ls `echo .`",
      { shell: "/bin/zsh" },
      (err, stdout, stderr) => {}
    ).unref();
    execSync("ls `echo .`", { shell: "/bin/zsh" }, (err, stdout, stderr) => {});
  };

  runCommands();

  runWithContext(unsafeContext, () => {
    runCommands();
  });
});

t.test("it detects shell injection", async (t) => {
  const agent = new Agent(
    true,
    new LoggerNoop(),
    new APIForTesting(),
    undefined,
    true
  );

  agent.start([new ChildProcess()]);

  const { exec, execSync } = require("child_process");

  const runCommands = () => {
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
  };

  runWithContext(unsafeContext, () => {
    runCommands();
  });
});
