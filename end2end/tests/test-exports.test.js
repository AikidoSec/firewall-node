const t = require("tap");
const { execSync } = require("child_process");
const { resolve } = require("path");

const pathToApp = resolve(__dirname, "../../sample-apps/test-exports");
const nodeVersion = parseInt(process.version.substring(1).split(".")[0]);

t.test("all package.json exports should work with CommonJS", async (t) => {
  try {
    execSync("node test.js", {
      cwd: pathToApp,
    });
  } catch (error) {
    t.fail("CommonJS exports test failed");
  }
});

t.test(
  "all package.json exports should work with TypeScript Node 18",
  { skip: nodeVersion !== 18 },
  async (t) => {
    try {
      execSync("node_modules/.bin/tsc -p tsconfig.node18.json", {
        cwd: pathToApp,
      });

      execSync("node dist18/test.js", {
        cwd: pathToApp,
      });
    } catch (error) {
      t.fail("TypeScript Node 18 exports test failed");
    }
  }
);

t.test(
  "all package.json exports should work with TypeScript Node 24",
  { skip: nodeVersion !== 24 },
  async (t) => {
    try {
      execSync("node_modules/.bin/tsc -p tsconfig.node24.json", {
        cwd: pathToApp,
      });

      execSync("node dist24/test.js", {
        cwd: pathToApp,
      });
    } catch (error) {
      t.fail("TypeScript Node 24 exports test failed");
    }
  }
);

t.test(
  "all package.json exports should work with Node 24 strip-types",
  { skip: nodeVersion < 24 },
  async (t) => {
    try {
      execSync("node --experimental-strip-types test.ts", {
        cwd: pathToApp,
      });
    } catch (error) {
      t.fail("Node 24 strip-types exports test failed");
    }
  }
);
