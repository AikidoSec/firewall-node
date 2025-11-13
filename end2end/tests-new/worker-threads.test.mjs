import { spawn } from "child_process";
import { test } from "node:test";
import { equal, fail, match } from "node:assert";

test("it prints a warning when using worker threads", async () => {
  const app = spawn(
    `node`,
    ["-r", "../../build/instrument/index.js", `./fixtures/worker-thread.mjs`],
    {
      cwd: import.meta.dirname,
      env: {
        ...process.env,
        AIKIDO_DEBUG: "true",
        AIKIDO_BLOCK: "true",
      },
    }
  );

  app.on("error", (err) => {
    fail(`Failed to start subprocess: ${err}`);
  });

  let stdout = "";
  let stderr = "";

  app.stdout.on("data", (data) => {
    stdout += data.toString();
  });

  app.stderr.on("data", (data) => {
    stderr += data.toString();
  });

  await new Promise((resolve) => {
    app.on("exit", (code) => {
      console.error("STDOUT:", stdout);
      console.error("STDERR:", stderr);
      match(
        stderr,
        /Zen does not instrument worker threads. Zen will only be active in the main thread./,
        "Expected log not found"
      );
      equal(code, 0, "Process exited with non-zero code");

      resolve();
    });
  });
});
