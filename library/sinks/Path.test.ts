import * as t from "tap";
import { Agent } from "../agent/Agent";
import { APIForTesting } from "../agent/api/APIForTesting";
import { Context, runWithContext } from "../agent/Context";
import { LoggerNoop } from "../agent/logger/LoggerNoop";
import { Path } from "./Path";

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
};

t.test("it works", async (t) => {
  const agent = new Agent(
    true,
    new LoggerNoop(),
    new APIForTesting(),
    undefined,
    undefined
  );

  agent.start([new Path()]);

  const { join, resolve } = require("path");

  function safeCalls() {
    t.same(join("test.txt"), "test.txt");
    t.same(resolve(__dirname, "./test.txt"), join(__dirname, "./test.txt"));
  }

  safeCalls();

  runWithContext(unsafeContext, () => {
    safeCalls();
  });

  runWithContext(unsafeContext, () => {
    t.throws(
      () => join(__dirname, "../test.txt"),
      "Aikido runtime has blocked a Path traversal: fs.join(...) originating from body.file.matches"
    );

    t.throws(
      () => resolve(__dirname, "../test.txt"),
      "Aikido runtime has blocked a Path traversal: fs.resolve(...) originating from body.file.matches"
    );

    t.throws(
      () => join(__dirname, "some_directory", "../test.txt"),
      "Aikido runtime has blocked a Path traversal: fs.join(...) originating from body.file.matches"
    );

    t.throws(
      () => resolve(__dirname, "some_directory", "../test.txt"),
      "Aikido runtime has blocked a Path traversal: fs.resolve(...) originating from body.file.matches"
    );

    t.throws(
      () => join(__dirname, "some_directory", "../../test.txt"),
      "Aikido runtime has blocked a Path traversal: fs.join(...) originating from body.file.matches"
    );

    t.throws(
      () => resolve(__dirname, "../test.txt", "some_directory"),
      "Aikido runtime has blocked a Path traversal: fs.resolve(...) originating from body.file.matches"
    );

    t.throws(
      () => join(__dirname, "../test.txt", "some_directory"),
      "Aikido runtime has blocked a Path traversal: fs.join(...) originating from body.file.matches"
    );
  });
});
