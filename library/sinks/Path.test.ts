import * as t from "tap";
import { Context, runWithContext } from "../agent/Context";
import { isWrapped, originalSymbol } from "../helpers/wrap";
import { Path } from "./Path";
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

const safeAbsoluteContext: Context = {
  ...unsafeContext,
  body: { file: { matches: "/etc/" } },
};

const unsafeAbsoluteContext: Context = {
  ...unsafeContext,
  body: { file: { matches: "/etc/some_directory" } },
};

t.test("it works", async (t) => {
  const agent = createTestAgent();

  agent.start([new Path()]);

  // Path required before path/posix and path/win32
  const { join, resolve, normalize } = require("path");

  function safeCalls() {
    t.same(join("test.txt"), "test.txt");
    t.same(resolve(__dirname, "./test.txt"), join(__dirname, "./test.txt"));
    t.same(join("/app", "/etc/data"), resolve("/app/etc/data"));
  }

  safeCalls();

  runWithContext(unsafeContext, () => {
    safeCalls();
  });

  runWithContext(unsafeContext, () => {
    const error = t.throws(() => join(__dirname, "../test.txt"));
    t.same(
      error instanceof Error ? error.message : null,
      "Zen has blocked a path traversal attack: path.normalize(...) originating from body.file.matches"
    );

    const error2 = t.throws(() => resolve(__dirname, "../test.txt"));
    t.same(
      error2 instanceof Error ? error2.message : null,
      "Zen has blocked a path traversal attack: path.resolve(...) originating from body.file.matches"
    );

    const error3 = t.throws(() =>
      join(__dirname, "some_directory", "../test.txt")
    );
    t.same(
      error3 instanceof Error ? error3.message : null,
      "Zen has blocked a path traversal attack: path.normalize(...) originating from body.file.matches"
    );

    const error4 = t.throws(() =>
      resolve(__dirname, "some_directory", "../test.txt")
    );
    t.same(
      error4 instanceof Error ? error4.message : null,
      "Zen has blocked a path traversal attack: path.resolve(...) originating from body.file.matches"
    );

    const error5 = t.throws(() =>
      join(__dirname, "some_directory", "../../test.txt")
    );
    t.same(
      error5 instanceof Error ? error5.message : null,
      "Zen has blocked a path traversal attack: path.normalize(...) originating from body.file.matches"
    );

    const error6 = t.throws(() =>
      resolve(__dirname, "../test.txt", "some_directory")
    );
    t.same(
      error6 instanceof Error ? error6.message : null,
      "Zen has blocked a path traversal attack: path.resolve(...) originating from body.file.matches"
    );

    const error7 = t.throws(() =>
      join(__dirname, "../test.txt", "some_directory")
    );
    t.same(
      error7 instanceof Error ? error7.message : null,
      "Zen has blocked a path traversal attack: path.normalize(...) originating from body.file.matches"
    );
  });

  runWithContext(unsafeAbsoluteContext, () => {
    safeCalls();
  });

  runWithContext(unsafeAbsoluteContext, () => {
    join("/etc/nginx", "test.txt");

    const error = t.throws(() => join("/etc/some_directory", "test.txt"));
    t.same(
      error instanceof Error ? error.message : null,
      "Zen has blocked a path traversal attack: path.normalize(...) originating from body.file.matches"
    );

    const error2 = t.throws(() =>
      resolve("/etc/some_directory", "abc", "test.txt")
    );
    t.same(
      error2 instanceof Error ? error2.message : null,
      "Zen has blocked a path traversal attack: path.resolve(...) originating from body.file.matches"
    );

    const error3 = t.throws(() => resolve("/tmp", "/etc/some_directory"));
    t.same(
      error3 instanceof Error ? error3.message : null,
      "Zen has blocked a path traversal attack: path.resolve(...) originating from body.file.matches"
    );

    const error4 = t.throws(() => resolve("/tmp", "//etc/some_directory"));
    t.same(
      error4 instanceof Error ? error4.message : null,
      "Zen has blocked a path traversal attack: path.resolve(...) originating from body.file.matches"
    );

    const error5 = t.throws(() => resolve("//tmp/", "//etc/some_directory"));
    t.same(
      error5 instanceof Error ? error5.message : null,
      "Zen has blocked a path traversal attack: path.resolve(...) originating from body.file.matches"
    );

    t.same(join("//tmp/", "//etc/some_directory"), "/tmp/etc/some_directory");
    t.same(normalize("//tmp/", "//etc/some_directory"), "/tmp/");
  });

  runWithContext(safeAbsoluteContext, () => {
    resolve("/etc/some_directory", "test.txt");
  });

  const { join: joinWin } = require("path/win32");

  runWithContext(unsafeAbsoluteContext, () => {
    const error = t.throws(() => joinWin("/etc/some_directory", "test.txt"));
    t.same(
      error instanceof Error ? error.message : null,
      "Zen has blocked a path traversal attack: path.normalize(...) originating from body.file.matches"
    );
  });

  const { normalize: normalizePosix } = require("path/posix");

  runWithContext(unsafeContext, () => {
    const error = t.throws(() => normalizePosix(__dirname, "../test.txt"));
    t.same(
      error instanceof Error ? error.message : null,
      "Zen has blocked a path traversal attack: path.normalize(...) originating from body.file.matches"
    );
  });

  const { win32: win32FromPosix } = require("path/posix");

  runWithContext(unsafeContext, () => {
    const error = t.throws(() =>
      win32FromPosix.normalize(__dirname, "../test.txt")
    );
    t.same(
      error instanceof Error ? error.message : null,
      "Zen has blocked a path traversal attack: path.normalize(...) originating from body.file.matches"
    );
  });

  const checkForDoubleWrapping = [join, resolve, normalize];
  for (const fn of checkForDoubleWrapping) {
    if (isWrapped(fn) && isWrapped(fn[originalSymbol])) {
      t.fail(`${fn.name} is double wrapped!`);
    }
  }
});
