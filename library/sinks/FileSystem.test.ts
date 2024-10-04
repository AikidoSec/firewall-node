import t from "tap";
import { Agent } from "../agent/Agent";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import { Context, runWithContext } from "../agent/Context";
import { LoggerNoop } from "../agent/logger/LoggerNoop";
import { FileSystem } from "./FileSystem";
import { isCJS } from "../helpers/isCJS";

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
  const agent = new Agent(
    true,
    new LoggerNoop(),
    new ReportingAPIForTesting(),
    undefined,
    "lambda",
    !isCJS()
  );

  agent.start([new FileSystem()]);

  const {
    writeFile,
    writeFileSync,
    rename,
    realpath,
    promises: fsDotPromise,
    realpathSync,
  } = isCJS() ? require("fs") : await import("fs");
  const { writeFile: writeFilePromise } = isCJS()
    ? require("fs/promises")
    : await import("fs/promises");

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
      (err) => {}
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
    rename("./test.txt", "./test2.txt", (err) => {});
    rename(new URL("file:///test123.txt"), "test2.txt", (err) => {});
    rename(Buffer.from("./test123.txt"), "test2.txt", (err) => {});
  };

  await runSafeCommands();

  await runWithContext(unsafeContext, async () => {
    await runSafeCommands();
  });

  await runWithContext(unsafeContext, async () => {
    throws(
      () =>
        writeFile(
          "../../test.txt",
          "some file content to test with",
          { encoding: "utf-8" },
          (err) => {}
        ),
      "Zen has blocked a path traversal attack: fs.writeFile(...) originating from body.file.matches"
    );

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
      t.match(
        error.message,
        "Zen has blocked a path traversal attack: fs.writeFile(...) originating from body.file.matches"
      );
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
      t.match(
        error2.message,
        "Zen has blocked a path traversal attack: fs.writeFile(...) originating from body.file.matches"
      );
    }

    throws(
      () => rename("../../test.txt", "./test2.txt", (err) => {}),
      "Zen has blocked a path traversal attack: fs.rename(...) originating from body.file.matches"
    );

    throws(
      () => rename("./test.txt", "../../test.txt", (err) => {}),
      "Zen has blocked a path traversal attack: fs.rename(...) originating from body.file.matches"
    );

    throws(
      () => rename(new URL("file:///../test.txt"), "../test2.txt", (err) => {}),
      "Zen has blocked a path traversal attack: fs.rename(...) originating from body.file.matches"
    );

    throws(
      () =>
        rename(new URL("file:///./../test.txt"), "../test2.txt", (err) => {}),
      "Zen has blocked a path traversal attack: fs.rename(...) originating from body.file.matches"
    );

    throws(
      () =>
        rename(new URL("file:///../../test.txt"), "../test2.txt", (err) => {}),
      "Zen has blocked a path traversal attack: fs.rename(...) originating from body.file.matches"
    );

    throws(
      () => rename(Buffer.from("../test.txt"), "../test2.txt", (err) => {}),
      "Zen has blocked a path traversal attack: fs.rename(...) originating from body.file.matches"
    );
  });

  runWithContext(unsafeContextAbsolute, () => {
    throws(
      () =>
        rename(new URL("file:///etc/passwd"), "../test123.txt", (err) => {}),
      "Zen has blocked a path traversal attack: fs.rename(...) originating from body.file.matches"
    );
    throws(
      () =>
        rename(new URL("file:///../etc/passwd"), "../test123.txt", (err) => {}),
      "Zen has blocked a path traversal attack: fs.rename(...) originating from body.file.matches"
    );
  });

  // Ignores malformed URLs
  runWithContext(
    { ...unsafeContext, body: { file: { matches: "../%" } } },
    () => {
      rename(new URL("file:///../../test.txt"), "../test2.txt", (err) => {});
    }
  );
});
