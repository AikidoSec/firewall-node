import * as t from "tap";
import { Agent } from "../agent/Agent";
import { APIForTesting } from "../agent/api/APIForTesting";
import { Context, runWithContext } from "../agent/Context";
import { LoggerNoop } from "../agent/logger/LoggerNoop";
import { PathTraversal } from "./PathTraversal";

const unsafeContext: Context = {
  remoteAddress: "::1",
  method: "POST",
  url: "http://localhost:4000",
  query: {},
  headers: {},
  body: {
    file: {
      matches: "..\\..\\test.txt",
    },
  },
  cookies: {},
  source: "express",
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
    new APIForTesting(),
    undefined,
    "lambda"
  );

  agent.start([new PathTraversal()]);

  const { writeFile, writeFileSync } = require("fs");

  const runCommandsWithInvalidArgs = () => {
    throws(() => writeFile(), /Received undefined/);
    throws(() => writeFileSync(), /Received undefined/);
  };

  runCommandsWithInvalidArgs();

  runWithContext(unsafeContext, () => {
    runCommandsWithInvalidArgs();
  });

  const runSafeCommands = () => {
    writeFile("./test.txt", "some file content to test with", (err) => {});
    writeFileSync("./test.txt", "some other file content to test with");
  };

  runSafeCommands();

  runWithContext(unsafeContext, () => {
    runSafeCommands();
  });

  runWithContext(unsafeContext, () => {
    throws(
      () =>
        writeFile(
          "..\\..\\test.txt",
          "some file content to test with",
          (err) => {}
        ),
      "Aikido runtime has blocked a Path traversal: fs.writeFile(...) originating from body.file.matches"
    );

    throws(
      () =>
        writeFileSync(
          "..\\..\\test.txt",
          "some other file content to test with"
        ),
      "Aikido runtime has blocked a Path traversal: fs.writeFileSync(...) originating from body.file.matches"
    );
  });
});
