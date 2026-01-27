import * as t from "tap";
import { getContext, runWithContext, type Context } from "../agent/Context";
import { Shelljs } from "./Shelljs";
import { ChildProcess } from "./ChildProcess";
import { FileSystem } from "./FileSystem";
import { createTestAgent } from "../helpers/createTestAgent";
import { isEsmUnitTest } from "../helpers/isEsmUnitTest";

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

const agent = createTestAgent();
agent.start([new Shelljs(), new FileSystem(), new ChildProcess()]);

let shelljs = require("shelljs");
if (isEsmUnitTest()) {
  shelljs = shelljs.default;
}

t.test("it detects shell injections", async (t) => {
  const error = await t.rejects(async () => {
    runWithContext(dangerousContext, () => {
      return shelljs.exec("ls -la xyz;pwd||x=");
    });
  });

  t.ok(error instanceof Error);
  if (error instanceof Error) {
    t.same(
      error.message,
      "Zen has blocked a shell injection: shelljs.exec(...) originating from body.myTitle"
    );
  }
});

t.test("it does not detect injection in safe context", async () => {
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
  try {
    shelljs.exec("ls -la xyz;pwd||x=", { silent: true });
    t.end();
  } catch (error) {
    t.fail();
  }
});

t.test("it detects async shell injections", async (t) => {
  const error = await t.rejects(async () => {
    runWithContext(dangerousContext, () => {
      return shelljs.exec("ls -la xyz;pwd||x=", { async: true });
    });
  });

  t.ok(error instanceof Error);
  if (error instanceof Error) {
    t.same(
      error.message,
      "Zen has blocked a shell injection: child_process.execFile(...) originating from body.myTitle"
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
      "Zen has blocked a shell injection: child_process.execFile(...) originating from body.myTitle"
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
      "Zen has blocked a shell injection: child_process.execFile(...) originating from body.myTitle"
    );
  }
});

t.test("it prevents path injections using ls", async (t) => {
  const error = await t.rejects(async () => {
    runWithContext(dangerousPathContext, () => {
      return shelljs.ls("/etc/ssh");
    });
  });
  t.ok(error instanceof Error);
  if (error instanceof Error) {
    t.same(
      error.message,
      "Zen has blocked a path traversal attack: fs.readdirSync(...) originating from body.myTitle"
    );
  }
});

t.test("it prevents path injections using cat", async (t) => {
  const error = await t.rejects(async () => {
    runWithContext(
      { ...dangerousPathContext, body: { myTitle: "../package.json" } },
      () => {
        return shelljs.cat("../package.json");
      }
    );
  });

  t.ok(error instanceof Error);
  if (error instanceof Error) {
    t.same(
      error.message,
      "Zen has blocked a path traversal attack: fs.readFileSync(...) originating from body.myTitle"
    );
  }
});

t.test(
  "it does not prevent path injections using cat with safe context",
  async () => {
    try {
      runWithContext(safeContext, () => {
        return shelljs.cat("/etc/ssh/*");
      });
      t.end();
    } catch (error) {
      t.fail(error as Error);
    }
  }
);

t.test("invalid arguments are passed to shelljs", async () => {
  runWithContext(safeContext, () => {
    const result = shelljs.exec(["ls", "-la", "/"], { silent: true });
    t.same(result.code, 1);
  });
});
