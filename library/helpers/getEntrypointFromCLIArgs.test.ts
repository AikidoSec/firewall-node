import * as t from "tap";
import { resolve } from "path";
import { getEntrypointFromCLIArgs } from "./getEntrypointFromCLIArgs";

function withCliArgs(argv: string[], execArgv: string[], callback: () => void) {
  const previousArgv = process.argv;
  const previousExecArgv = process.execArgv;

  process.argv = argv;
  process.execArgv = execArgv;

  try {
    callback();
  } finally {
    process.argv = previousArgv;
    process.execArgv = previousExecArgv;
  }
}

t.test("returns absolute entrypoint as-is", async (t) => {
  withCliArgs(["node", "/app/server.js"], [], () => {
    t.equal(getEntrypointFromCLIArgs(), "/app/server.js");
  });
});

t.test("resolves relative entrypoint to absolute path", async (t) => {
  withCliArgs(["node", "src/server.js"], [], () => {
    t.equal(getEntrypointFromCLIArgs(), resolve("src/server.js"));
  });
});

t.test("returns undefined when no script argument exists", async (t) => {
  withCliArgs(["node"], [], () => {
    t.equal(getEntrypointFromCLIArgs(), undefined);
  });
});

t.test("returns undefined when candidate is stdin marker", async (t) => {
  withCliArgs(["node", "-"], [], () => {
    t.equal(getEntrypointFromCLIArgs(), undefined);
  });
});

t.test("returns undefined in eval mode", async (t) => {
  withCliArgs(["node"], ["--eval", "console.log('x')"], () => {
    t.equal(getEntrypointFromCLIArgs(), undefined);
  });
});

t.test("supports node inspect subcommand", async (t) => {
  withCliArgs(["node", "inspect", "app.js"], [], () => {
    t.equal(getEntrypointFromCLIArgs(), resolve("app.js"));
  });
});

t.test("inspect without argument returns undefined", async (t) => {
  withCliArgs(["node", "inspect"], [], () => {
    t.equal(getEntrypointFromCLIArgs(), undefined);
  });
});

t.test("supports node debug subcommand", async (t) => {
  withCliArgs(["node", "debug", "app.js"], [], () => {
    t.equal(getEntrypointFromCLIArgs(), resolve("app.js"));
  });
});
