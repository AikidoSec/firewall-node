import * as t from "tap";
import { Context, runWithContext } from "../agent/Context";
import { ChildProcess } from "./ChildProcess";
import { createTestAgent } from "../helpers/createTestAgent";
import { join } from "path";

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

t.test("it works", async (t) => {
  const agent = createTestAgent({
    serverless: "lambda",
  });

  agent.start([new ChildProcess()]);

  const { exec, execSync, spawn, spawnSync, fork, execFile, execFileSync } =
    require("child_process") as typeof import("child_process");

  const runCommandsWithInvalidArgs = () => {
    throws(
      // @ts-expect-error Testing invalid arguments
      () => exec().unref(),
      /argument must be of type string. Received undefined/
    );

    throws(
      // @ts-expect-error Testing invalid arguments
      () => execSync(),
      /argument must be of type string. Received undefined/
    );

    throws(
      // @ts-expect-error Testing invalid arguments
      () => spawn().unref(),
      /argument must be of type string. Received undefined/
    );

    throws(
      // @ts-expect-error Testing invalid arguments
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
    execSync("ls");

    spawn("ls", ["-la"], {}).unref();
    spawnSync("ls", ["-la"], {});

    spawn("ls", ["-la"], { shell: false }).unref();
    spawnSync("ls", ["-la"], { shell: false });

    execFile("ls", ["-la"], {}, (err, stdout, stderr) => {}).unref();
    execFileSync("ls", ["-la"], {});

    fork(join(__dirname, "./fixtures/helloWorld.js")).unref();
  };

  runSafeCommands();

  runWithContext(unsafeContext, () => {
    runSafeCommands();
  });

  runWithContext(unsafeContext, () => {
    throws(
      () => execSync("ls `echo .`"),
      "Zen has blocked a shell injection: child_process.execSync(...) originating from body.file.matches"
    );
  });

  await runWithContext(unsafeContext, async () => {
    await new Promise<void>((resolve) => {
      exec("ls `echo .`", (err) => {
        t.ok(err instanceof Error);
        if (err instanceof Error)
          t.match(
            err.message,
            "Zen has blocked a shell injection: child_process.execFile(...) originating from body.file.matches"
          );
        resolve();
      });
    });
  });

  runWithContext(unsafeContext, () => {
    throws(
      () => spawn("ls `echo .`", [], { shell: true }).unref(),
      "Zen has blocked a shell injection: child_process.spawn(...) originating from body.file.matches"
    );

    throws(
      () => spawn("ls", ["`echo .`"], { shell: "/bin/sh" }).unref(),
      "Zen has blocked a shell injection: child_process.spawn(...) originating from body.file.matches"
    );

    // The following tests should be blocking, because user input is passed to a shell spawned by the developer.
    // This is basically the equivalent of shell: true.
    // While shell: false (and thus native functionality of spawning a shell is not used), we should check if the developer directly invokes
    // the shell via sh -c, and validate the arguments of the command.
    throws(
      () => spawn("sh", ["-c", "`echo .`"], { shell: false }).unref(),
      "Zen has blocked a shell injection: child_process.spawn(...) originating from body.file.matches"
    );

    throws(
      () => spawn("/bin/sh", ["-c", "`echo .`"], { shell: false }).unref(),
      "Zen has blocked a shell injection: child_process.spawn(...) originating from body.file.matches"
    );

    throws(
      () => spawn("bash", ["-c", "`echo .`"], { shell: false }).unref(),
      "Zen has blocked a shell injection: child_process.spawn(...) originating from body.file.matches"
    );

    throws(
      () => spawn("/bin/bash", ["-c", "`echo .`"], { shell: false }).unref(),
      "Zen has blocked a shell injection: child_process.spawn(...) originating from body.file.matches"
    );

    throws(
      () => spawnSync("/bin/bash", ["-c", "`echo .`"]),
      "Zen has blocked a shell injection: child_process.spawnSync(...) originating from body.file.matches"
    );

    throws(
      () => spawnSync("ls `echo .`", [], { shell: true }),
      "Zen has blocked a shell injection: child_process.spawnSync(...) originating from body.file.matches"
    );

    throws(
      () => spawnSync("ls `echo .`", [], { shell: "/bin/sh" }),
      "Zen has blocked a shell injection: child_process.spawnSync(...) originating from body.file.matches"
    );
  });

  runWithContext(unsafeContext, () => {
    throws(
      () => execFileSync("ls `echo .`", [], { shell: true }),
      "Zen has blocked a shell injection: child_process.execFileSync(...) originating from body.file.matches"
    );

    throws(
      () => execFileSync("/bin/sh", ["-c", "`echo .`"]),
      "Zen has blocked a shell injection: child_process.execFileSync(...) originating from body.file.matches"
    );

    throws(
      () => execFileSync("ls", ["`echo .`"], { shell: true }),
      "Zen has blocked a shell injection: child_process.execFileSync(...) originating from body.file.matches"
    );
  });

  await runWithContext(unsafeContext, async () => {
    const msg =
      "Zen has blocked a shell injection: child_process.execFile(...) originating from body.file.matches";

    await new Promise<void>((resolve) => {
      execFile("ls `echo .`", [], { shell: true }, (err) => {
        t.ok(err instanceof Error);
        if (err instanceof Error) t.match(err.message, msg);
        resolve();
      });
    });

    await new Promise<void>((resolve) => {
      execFile("ls", ["`echo .`"], { shell: true }, (err) => {
        t.ok(err instanceof Error);
        if (err instanceof Error) t.match(err.message, msg);
        resolve();
      });
    });

    await new Promise<void>((resolve) => {
      execFile("sh", ["-c", "`echo .`"], (err) => {
        t.ok(err instanceof Error);
        if (err instanceof Error) t.match(err.message, msg);
        resolve();
      });
    });

    await new Promise<void>((resolve) => {
      execFile("/bin/sh", ["-c", "`echo .`"], (err) => {
        t.ok(err instanceof Error);
        if (err instanceof Error) t.match(err.message, msg);
        resolve();
      });
    });
  });

  runWithContext(
    { ...unsafeContext, body: { file: { matches: "/../rce.js" } } },
    () => {
      throws(
        () => fork("./fixtures/../rce.js", [], {}),
        "Zen has blocked a path traversal attack: child_process.fork(...) originating from body.file.matches"
      );
    }
  );
});
