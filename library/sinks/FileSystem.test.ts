import * as t from "tap";
import { Agent } from "../agent/Agent";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import { Context, runWithContext } from "../agent/Context";
import { LoggerNoop } from "../agent/logger/LoggerNoop";
import { FileSystem } from "./FileSystem";

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
    "lambda"
  );

  agent.start([new FileSystem()]);

  const { writeFile, writeFileSync, rename } = require("fs");
  const { writeFile: writeFilePromise } = require("fs/promises");

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
    rename("./test.txt", "./test2.txt", (err) => {});
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
      "Aikido runtime has blocked a path traversal attack: fs.writeFile(...) originating from body.file.matches"
    );

    throws(
      () =>
        writeFileSync(
          "../../test.txt",
          "some other file content to test with",
          { encoding: "utf-8" }
        ),
      "Aikido runtime has blocked a path traversal attack: fs.writeFileSync(...) originating from body.file.matches"
    );

    const error = await t.rejects(() =>
      writeFilePromise(
        "../../test.txt",
        "some other file content to test with",
        { encoding: "utf-8" }
      )
    );

    if (error instanceof Error) {
      t.match(
        error.message,
        "Aikido runtime has blocked a path traversal attack: fs.writeFile(...) originating from body.file.matches"
      );
    }

    throws(
      () => rename("../../test.txt", "./test2.txt", (err) => {}),
      "Aikido runtime has blocked a path traversal attack: fs.rename(...) originating from body.file.matches"
    );

    throws(
      () => rename("./test.txt", "../../test.txt", (err) => {}),
      "Aikido runtime has blocked a path traversal attack: fs.rename(...) originating from body.file.matches"
    );
  });
});
