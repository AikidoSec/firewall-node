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

// Test for the security fix: ShellJS 0.10.x bypass vulnerability
t.test(
  "shelljs 0.10.x is instrumented and blocks shell injection",
  async (t) => {
    // Verify that shelljs version 0.10.x is being used
    const shelljsPackage = require("shelljs/package.json");
    t.match(
      shelljsPackage.version,
      /^0\.10\./,
      "Test should run with shelljs 0.10.x"
    );

    // Test that shell injection is detected in version 0.10.x
    const error = await t.rejects(async () => {
      runWithContext(dangerousContext, () => {
        return shelljs.exec("echo xyz;pwd||x=");
      });
    });

    t.ok(error instanceof Error);
    if (error instanceof Error) {
      t.match(
        error.message,
        /Zen has blocked a shell injection/,
        "Shell injection should be blocked for shelljs 0.10.x"
      );
      t.match(
        error.message,
        /shelljs\.exec/,
        "Error should reference shelljs.exec operation"
      );
    }
  }
);

t.test(
  "shelljs 0.10.x execSync is instrumented and blocks shell injection",
  async (t) => {
    // Test that the execSync instrumentation works for 0.10.x
    const error = await t.rejects(async () => {
      runWithContext(dangerousContext, () => {
        // execSync is the internal function that gets instrumented
        return shelljs.exec("ls xyz;pwd||x=", { silent: true });
      });
    });

    t.ok(error instanceof Error);
    if (error instanceof Error) {
      t.match(
        error.message,
        /Zen has blocked a shell injection/,
        "execSync should be instrumented in shelljs 0.10.x"
      );
    }
  }
);

t.test(
  "shelljs 0.10.x allows safe commands without user input",
  async (t) => {
    // Verify that safe commands still work in 0.10.x
    try {
      runWithContext(safeContext, () => {
        const result = shelljs.exec("echo test", { silent: true });
        t.ok(result.code === 0 || result.code === 1); // Command may succeed or fail, but shouldn't throw
      });
      t.pass("Safe commands should execute without blocking");
    } catch (error) {
      t.fail("Safe commands should not be blocked");
    }
  }
);

t.test(
  "shelljs 0.10.x blocks injection with various shell metacharacters",
  async (t) => {
    const dangerousCommands = [
      "ls; cat /etc/passwd",
      "ls && cat /etc/passwd",
      "ls || cat /etc/passwd",
      "ls | cat /etc/passwd",
      "ls `cat /etc/passwd`",
      "ls $(cat /etc/passwd)",
    ];

    for (const cmd of dangerousCommands) {
      const contextWithCmd: Context = {
        ...dangerousContext,
        body: { myTitle: cmd },
      };

      const error = await t.rejects(async () => {
        runWithContext(contextWithCmd, () => {
          return shelljs.exec(cmd, { silent: true });
        });
      });

      t.ok(error instanceof Error, `Should block: ${cmd}`);
      if (error instanceof Error) {
        t.match(
          error.message,
          /Zen has blocked a shell injection/,
          `Should detect injection in: ${cmd}`
        );
      }
    }
  }
);
