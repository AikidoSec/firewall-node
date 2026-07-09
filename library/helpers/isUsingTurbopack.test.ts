import t from "tap";
import { isUsingTurbopack } from "./isUsingTurbopack";

const originalEnv = process.env.TURBOPACK;
const originalStandaloneConfig = process.env.__NEXT_PRIVATE_STANDALONE_CONFIG;
const originalArgv = process.argv.slice();

t.afterEach(() => {
  process.env.TURBOPACK = originalEnv;
  process.env.__NEXT_PRIVATE_STANDALONE_CONFIG = originalStandaloneConfig;
  process.argv = originalArgv.slice();
});

t.test("it works", async (t) => {
  t.test("returns true if TURBOPACK env variable is set", (t) => {
    process.env.TURBOPACK = "1";
    t.equal(isUsingTurbopack(), true);
    t.end();
  });

  t.test("returns true if --turbo flag is present in argv", (t) => {
    process.argv.push("--turbo");
    t.equal(isUsingTurbopack(), true);
    t.end();
  });

  t.test(
    "returns false if neither TURBOPACK env variable nor --turbo flag is set",
    (t) => {
      delete process.env.TURBOPACK;
      delete process.env.__NEXT_PRIVATE_STANDALONE_CONFIG;
      process.argv = process.argv.filter((arg) => arg !== "--turbo");
      t.equal(isUsingTurbopack(), false);
      t.end();
    }
  );

  t.test(
    "returns true if __NEXT_PRIVATE_STANDALONE_CONFIG contains turbopack key",
    (t) => {
      delete process.env.TURBOPACK;
      process.env.__NEXT_PRIVATE_STANDALONE_CONFIG = JSON.stringify({
        turbopack: { root: "/app" },
      });
      t.equal(isUsingTurbopack(), true);
      t.end();
    }
  );

  t.test(
    "returns false if __NEXT_PRIVATE_STANDALONE_CONFIG has no turbopack key",
    (t) => {
      delete process.env.TURBOPACK;
      process.env.__NEXT_PRIVATE_STANDALONE_CONFIG = JSON.stringify({
        output: "standalone",
      });
      t.equal(isUsingTurbopack(), false);
      t.end();
    }
  );

  t.test(
    "returns false if __NEXT_PRIVATE_STANDALONE_CONFIG is invalid JSON",
    (t) => {
      delete process.env.TURBOPACK;
      process.env.__NEXT_PRIVATE_STANDALONE_CONFIG = "not-json";
      t.equal(isUsingTurbopack(), false);
      t.end();
    }
  );
});
