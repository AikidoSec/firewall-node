import * as t from "tap";
import { Agent } from "../agent/Agent";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import { getContext, runWithContext, type Context } from "../agent/Context";
import { LoggerNoop } from "../agent/logger/LoggerNoop";
import { Shelljs } from "./Shelljs";
import { ChildProcess } from "./ChildProcess";
import { FileSystem } from "./FileSystem";

const dangerousContext: Context = {
  remoteAddress: "::1",
  method: "POST",
  url: "http://localhost:4000",
  query: {},
  headers: {},
  body: {
    myTitle: `xyz;pwd||x=`,
  },
  cookies: {},
  routeParams: {},
  source: "express",
  route: "/posts/:id",
};

const dangerousPathContext: Context = {
  remoteAddress: "::1",
  method: "POST",
  url: "http://localhost:4000",
  query: {},
  headers: {},
  body: {
    myTitle: `/etc/ssh`,
  },
  cookies: {},
  routeParams: {},
  source: "express",
  route: "/posts/:id",
};

const safeContext: Context = {
  remoteAddress: "::1",
  method: "POST",
  url: "http://localhost:4000/",
  query: {},
  headers: {},
  body: {},
  cookies: {},
  routeParams: {},
  source: "express",
  route: "/posts/:id",
};

t.test("it detects shell injections", async () => {
  const agent = new Agent(
    true,
    new LoggerNoop(),
    new ReportingAPIForTesting(),
    undefined,
    undefined
  );
  agent.start([new Shelljs(), new FileSystem(), new ChildProcess()]);

  const shelljs = require("shelljs");

  const error = await t.rejects(async () => {
    runWithContext(dangerousContext, () => {
      return shelljs.exec("ls -la xyz;pwd||x=");
    });
  });

  t.ok(error instanceof Error);
  if (error instanceof Error) {
    t.same(
      error.message,
      "Aikido firewall has blocked a shell injection: shelljs.exec(...) originating from body.myTitle"
    );
  }
});

t.test("it does not detect injection in safe context", async () => {
  const agent = new Agent(
    true,
    new LoggerNoop(),
    new ReportingAPIForTesting(),
    undefined,
    undefined
  );
  agent.start([new Shelljs(), new FileSystem(), new ChildProcess()]);

  const shelljs = require("shelljs");

  try {
    runWithContext(safeContext, () => {
      return shelljs.exec("ls -la xyz;pwd||x=", { silent: true });
    });
    t.end();
  } catch (error) {
    t.fail();
  }
});

t.test("it does not detect injection without context", async () => {
  const agent = new Agent(
    true,
    new LoggerNoop(),
    new ReportingAPIForTesting(),
    undefined,
    undefined
  );
  agent.start([new Shelljs(), new FileSystem(), new ChildProcess()]);

  const shelljs = require("shelljs");

  try {
    shelljs.exec("ls -la xyz;pwd||x=", { silent: true });
    t.end();
  } catch (error) {
    t.fail();
  }
});

t.test("it detects async shell injections", async () => {
  const agent = new Agent(
    true,
    new LoggerNoop(),
    new ReportingAPIForTesting(),
    undefined,
    undefined
  );
  agent.start([new Shelljs(), new FileSystem(), new ChildProcess()]);

  const shelljs = require("shelljs");

  const error = await t.rejects(async () => {
    runWithContext(dangerousContext, () => {
      return shelljs.exec("ls -la xyz;pwd||x=", { async: true });
    });
  });

  t.ok(error instanceof Error);
  if (error instanceof Error) {
    t.same(
      error.message,
      "Aikido firewall has blocked a shell injection: child_process.exec(...) originating from body.myTitle"
    );
  }

  const error2 = await t.rejects(async () => {
    runWithContext(dangerousContext, () => {
      return shelljs.exec("ls -la xyz;pwd||x=", function callback() {});
    });
  });

  t.ok(error2 instanceof Error);
  if (error2 instanceof Error) {
    t.same(
      error2.message,
      "Aikido firewall has blocked a shell injection: child_process.exec(...) originating from body.myTitle"
    );
  }

  const error3 = await t.rejects(async () => {
    runWithContext(dangerousContext, () => {
      return shelljs.exec("ls -la xyz;pwd||x=", {}, function callback() {});
    });
  });

  t.ok(error3 instanceof Error);
  if (error3 instanceof Error) {
    t.same(
      error3.message,
      "Aikido firewall has blocked a shell injection: child_process.exec(...) originating from body.myTitle"
    );
  }
});

t.test("it prevents path injections using ls", async () => {
  const agent = new Agent(
    true,
    new LoggerNoop(),
    new ReportingAPIForTesting(),
    undefined,
    undefined
  );
  agent.start([new Shelljs(), new FileSystem(), new ChildProcess()]);

  const shelljs = require("shelljs");

  // The exception is catched by shelljs and can not directly be caught by the test
  runWithContext(dangerousPathContext, () => {
    const result = shelljs.ls("/etc/ssh");
    t.same(result.code, 2);
    t.ok(getContext()?.attackDetected);
  });
});

t.test("it prevents path injections using cat", async () => {
  const agent = new Agent(
    true,
    new LoggerNoop(),
    new ReportingAPIForTesting(),
    undefined,
    undefined
  );
  agent.start([new Shelljs(), new FileSystem(), new ChildProcess()]);

  const shelljs = require("shelljs");

  const error = await t.rejects(async () => {
    runWithContext(dangerousPathContext, () => {
      return shelljs.cat("/etc/ssh/*");
    });
  });

  t.ok(error instanceof Error);
  if (error instanceof Error) {
    t.same(
      error.message,
      "Aikido firewall has blocked a path traversal attack: fs.existsSync(...) originating from body.myTitle"
    );
  }
});

t.test(
  "it does not prevent path injections using cat with safe context",
  async () => {
    const agent = new Agent(
      true,
      new LoggerNoop(),
      new ReportingAPIForTesting(),
      undefined,
      undefined
    );
    agent.start([new Shelljs(), new FileSystem(), new ChildProcess()]);

    const shelljs = require("shelljs");

    try {
      runWithContext(safeContext, () => {
        return shelljs.cat("/etc/ssh/*");
      });
      t.end();
    } catch (error) {
      t.fail(error);
    }
  }
);

t.test("invalid arguments are passed to shelljs", async () => {
  const agent = new Agent(
    true,
    new LoggerNoop(),
    new ReportingAPIForTesting(),
    undefined,
    undefined
  );
  agent.start([new Shelljs(), new FileSystem(), new ChildProcess()]);

  const shelljs = require("shelljs");

  const result = shelljs.exec(["ls", "-la", "/"], { silent: true });
  t.same(result.code, 1);
});
