import * as t from "tap";
import { Agent } from "../agent/Agent";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import { Context, runWithContext } from "../agent/Context";
import { LoggerNoop } from "../agent/logger/LoggerNoop";
import { Path } from "./Path";
import { isWindows } from "../helpers/isWindows";

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

const unsafeAbsoluteContext: Context = {
  ...unsafeContext,
  body: { file: { matches: "/etc/" } },
};

t.test("it works", async (t) => {
  const agent = new Agent(
    true,
    new LoggerNoop(),
    new ReportingAPIForTesting(),
    undefined,
    undefined
  );

  agent.start([new Path()]);

  const { join, resolve } = require("path");

  function safeCalls() {
    t.same(join("test.txt"), "test.txt");
    t.same(resolve(__dirname, "./test.txt"), join(__dirname, "./test.txt"));
    if (!isWindows) {
      t.same(join("/app", "/etc/data"), resolve("/app/etc/data"));
    } else {
      t.same(join("x:/app", "/etc/data"), resolve("x:/app/etc/data"));
    }
  }

  safeCalls();

  runWithContext(unsafeContext, () => {
    safeCalls();
  });

  runWithContext(unsafeContext, () => {
    t.throws(
      () => join(__dirname, "../test.txt"),
      "Zen has blocked a Path traversal: fs.join(...) originating from body.file.matches"
    );

    t.throws(
      () => resolve(__dirname, "../test.txt"),
      "Zen has blocked a Path traversal: fs.resolve(...) originating from body.file.matches"
    );

    t.throws(
      () => join(__dirname, "some_directory", "../test.txt"),
      "Zen has blocked a Path traversal: fs.join(...) originating from body.file.matches"
    );

    t.throws(
      () => resolve(__dirname, "some_directory", "../test.txt"),
      "Zen has blocked a Path traversal: fs.resolve(...) originating from body.file.matches"
    );

    t.throws(
      () => join(__dirname, "some_directory", "../../test.txt"),
      "Zen has blocked a Path traversal: fs.join(...) originating from body.file.matches"
    );

    t.throws(
      () => resolve(__dirname, "../test.txt", "some_directory"),
      "Zen has blocked a Path traversal: fs.resolve(...) originating from body.file.matches"
    );

    t.throws(
      () => join(__dirname, "../test.txt", "some_directory"),
      "Zen has blocked a Path traversal: fs.join(...) originating from body.file.matches"
    );
  });

  runWithContext(unsafeAbsoluteContext, () => {
    safeCalls();
  });

  if (!isWindows) {
    runWithContext(unsafeAbsoluteContext, () => {
      t.throws(
        () => join("/etc/", "test.txt"),
        "Zen has blocked a Path traversal: fs.join(...) originating from body.file.matches"
      );

      t.throws(
        () => resolve("/etc/some_directory", "test.txt"),
        "Zen has blocked a Path traversal: fs.resolve(...) originating from body.file.matches"
      );
    });
  } else {
    runWithContext(
      {
        ...unsafeAbsoluteContext,
        ...{
          body: { file: { matches: "X:/etc/" } },
        },
      },
      () => {
        t.throws(
          () => resolve("X:/etc/", "test.txt"),
          "Zen has blocked a Path traversal: fs.join(...) originating from body.file.matches"
        );
      }
    );
  }
});
