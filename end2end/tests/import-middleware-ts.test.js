const t = require("tap");
const { execSync } = require("child_process");
const { resolve } = require("path");

const pathToApp = resolve(__dirname, "../../sample-apps/import-middleware-ts");

t.test("it passes type check when skipLibCheck is set to false", async (t) => {
  try {
    execSync(`npm run type-check`, {
      cwd: pathToApp,
    });
  } catch (error) {
    t.fail(error.stdout.toString());
  }
});
