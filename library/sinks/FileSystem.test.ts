import * as t from "tap";
import { Context, runWithContext } from "../agent/Context";
import { FileSystem } from "./FileSystem";
import { createTestAgent } from "../helpers/createTestAgent";

const unsafeContext: Context = {
  remoteAddress: "::1",
  method: "POST",
  url: "http://localhost:4000",
  query: {},
  headers: {},
  body: {
    file: {
      matches: "../test.txt",
    },
  },
  cookies: {},
  routeParams: {},
  source: "express",
  route: "/posts/:id",
};

const unsafeContextAbsolute: Context = {
  remoteAddress: "::1",
  method: "POST",
  url: "http://localhost:4000",
  query: {},
  headers: {},
  body: {
    file: {
      matches: "/etc/passwd",
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
  const agent = createTestAgent({ serverless: "lambda" });

  agent.start([new FileSystem()]);

  const {
    writeFile,
    writeFileSync,
    rename,
    realpath,
    promises: fsDotPromise,
    realpathSync,
  } = require("fs");
  const { writeFile: writeFilePromise } =
    require("fs/promises") as typeof import("fs/promises");

  t.ok(typeof realpath.native === "function");
  t.ok(typeof realpathSync.native === "function");

  const runCommandsWithInvalidArgs = () => {
    throws(() => writeFile(), /Received undefined/);
    throws(() => writeFileSync(), /Received undefined/);
  };

  runCommandsWithInvalidArgs();

  runWithContext(unsafeContext, () => {
    runCommandsWithInvalidArgs();
  });

  const runSafeCommands = async () => {
    writeFile(
      "./test.txt",
      "some file content to test with",
      { encoding: "utf-8" },
      () => {}
    );
    writeFileSync("./test.txt", "some other file content to test with", {
      encoding: "utf-8",
    });
    await writeFilePromise(
      "./test.txt",
      "some other file content to test with",
      { encoding: "utf-8" }
    );
    await fsDotPromise.writeFile(
      "./test.txt",
      "some other file content to test with",
      { encoding: "utf-8" }
    );
    rename("./test.txt", "./test2.txt", () => {});
    rename(new URL("file:///test123.txt"), "test2.txt", () => {});
    rename(Buffer.from("./test123.txt"), "test2.txt", () => {});
  };

  await runSafeCommands();

  await runWithContext(unsafeContext, async () => {
    await runSafeCommands();
  });

  await runWithContext(unsafeContext, async () => {
    const writeFileMsg =
      "Zen has blocked a path traversal attack: fs.writeFile(...) originating from body.file.matches";
    const renameMsg =
      "Zen has blocked a path traversal attack: fs.rename(...) originating from body.file.matches";

    await new Promise<void>((resolve) => {
      writeFile(
        "../../test.txt",
        "some file content to test with",
        { encoding: "utf-8" },
        (err: any) => {
          t.ok(err instanceof Error);
          if (err instanceof Error) t.match(err.message, writeFileMsg);
          resolve();
        }
      );
    });

    throws(
      () =>
        writeFileSync(
          "../../test.txt",
          "some other file content to test with",
          { encoding: "utf-8" }
        ),
      "Zen has blocked a path traversal attack: fs.writeFileSync(...) originating from body.file.matches"
    );

    const error = await t.rejects(() =>
      writeFilePromise(
        "../../test.txt",
        "some other file content to test with",
        { encoding: "utf-8" }
      )
    );
    t.ok(error instanceof Error);
    if (error instanceof Error) {
      t.match(error.message, writeFileMsg);
      t.same(error.stack!.includes("wrapExport.ts"), false);
    }

    const error2 = await t.rejects(() =>
      fsDotPromise.writeFile(
        "../../test.txt",
        "some other file content to test with",
        { encoding: "utf-8" }
      )
    );
    t.ok(error2 instanceof Error);
    if (error2 instanceof Error) {
      t.match(error2.message, writeFileMsg);
    }

    const error3 = await t.rejects(() =>
      fsDotPromise.readFile("../../test.txt", { encoding: "utf-8" })
    );
    t.ok(error3 instanceof Error);
    if (error3 instanceof Error) {
      t.match(
        error3.message,
        "Zen has blocked a path traversal attack: fs.readFile(...) originating from body.file.matches"
      );
    }

    await new Promise<void>((resolve) => {
      rename("../../test.txt", "./test2.txt", (err: any) => {
        t.ok(err instanceof Error);
        if (err instanceof Error) t.match(err.message, renameMsg);
        resolve();
      });
    });

    await new Promise<void>((resolve) => {
      rename("./test.txt", "../../test.txt", (err: any) => {
        t.ok(err instanceof Error);
        if (err instanceof Error) t.match(err.message, renameMsg);
        resolve();
      });
    });

    await new Promise<void>((resolve) => {
      rename(new URL("file:///../test.txt"), "../test2.txt", (err: any) => {
        t.ok(err instanceof Error);
        if (err instanceof Error) t.match(err.message, renameMsg);
        resolve();
      });
    });

    await new Promise<void>((resolve) => {
      rename(new URL("file:///./../test.txt"), "../test2.txt", (err: any) => {
        t.ok(err instanceof Error);
        if (err instanceof Error) t.match(err.message, renameMsg);
        resolve();
      });
    });

    await new Promise<void>((resolve) => {
      rename(new URL("file:///../../test.txt"), "../test2.txt", (err: any) => {
        t.ok(err instanceof Error);
        if (err instanceof Error) t.match(err.message, renameMsg);
        resolve();
      });
    });

    await new Promise<void>((resolve) => {
      rename(Buffer.from("../test.txt"), "../test2.txt", (err: any) => {
        t.ok(err instanceof Error);
        if (err instanceof Error) t.match(err.message, renameMsg);
        resolve();
      });
    });
  });

  await runWithContext(unsafeContextAbsolute, async () => {
    const msg =
      "Zen has blocked a path traversal attack: fs.rename(...) originating from body.file.matches";

    await new Promise<void>((resolve) => {
      rename(new URL("file:///etc/passwd"), "../test123.txt", (err: any) => {
        t.ok(err instanceof Error);
        if (err instanceof Error) t.match(err.message, msg);
        resolve();
      });
    });

    await new Promise<void>((resolve) => {
      rename(new URL("file:///../etc/passwd"), "../test123.txt", (err: any) => {
        t.ok(err instanceof Error);
        if (err instanceof Error) t.match(err.message, msg);
        resolve();
      });
    });

    await new Promise<void>((resolve) => {
      rename("/etc/passwd", "../test123.txt", (err: any) => {
        t.ok(err instanceof Error);
        if (err instanceof Error) t.match(err.message, msg);
        resolve();
      });
    });
  });

  await runWithContext(
    {
      ...unsafeContextAbsolute,
      body: { file: { matches: "//etc/passwd" } },
    },
    async () => {
      const msg =
        "Zen has blocked a path traversal attack: fs.rename(...) originating from body.file.matches";

      await new Promise<void>((resolve) => {
        rename(new URL("file:////etc/passwd"), "../test123.txt", (err: any) => {
          t.ok(err instanceof Error);
          if (err instanceof Error) t.match(err.message, msg);
          resolve();
        });
      });

      await new Promise<void>((resolve) => {
        rename("//etc/passwd", "../test123.txt", (err: any) => {
          t.ok(err instanceof Error);
          if (err instanceof Error) t.match(err.message, msg);
          resolve();
        });
      });
    }
  );

  await runWithContext(
    {
      remoteAddress: "::1",
      method: "POST",
      url: "http://localhost:4000",
      query: {
        q: ".\t./etc/passwd",
      },
      headers: {},
      body: {},
      cookies: {},
      routeParams: {},
      source: "express",
      route: "/posts/:id",
    },
    async () => {
      await new Promise<void>((resolve) => {
        rename(
          new URL("file:///.\t./etc/passwd"),
          "../test123.txt",
          (err: any) => {
            t.ok(err instanceof Error);
            if (err instanceof Error)
              t.match(
                err.message,
                "Zen has blocked a path traversal attack: fs.rename(...) originating from query.q"
              );
            resolve();
          }
        );
      });
    }
  );

  runWithContext(
    {
      remoteAddress: "::1",
      method: "POST",
      url: "http://localhost:4000",
      query: {
        q: "test/test.txt",
      },
      headers: {},
      body: {},
      cookies: {},
      routeParams: {},
      source: "express",
      route: "/posts/:id",
    },
    () => {
      rename(new URL("file:///test/test.txt"), "../test123.txt", () => {});
    }
  );

  await runWithContext(
    {
      remoteAddress: "::1",
      method: "POST",
      url: "http://localhost:4000",
      query: {
        q: ".\t\t./etc/passwd",
      },
      headers: {},
      body: {},
      cookies: {},
      routeParams: {},
      source: "express",
      route: "/posts/:id",
    },
    async () => {
      await new Promise<void>((resolve) => {
        rename(
          new URL("file:///.\t\t./etc/passwd"),
          "../test123.txt",
          (err: any) => {
            t.ok(err instanceof Error);
            if (err instanceof Error)
              t.match(
                err.message,
                "Zen has blocked a path traversal attack: fs.rename(...) originating from query.q"
              );
            resolve();
          }
        );
      });
    }
  );

  // Ignores malformed URLs
  runWithContext(
    { ...unsafeContext, body: { file: { matches: "../%" } } },
    () => {
      rename(new URL("file:///../../test.txt"), "../test2.txt", () => {});
    }
  );
});
