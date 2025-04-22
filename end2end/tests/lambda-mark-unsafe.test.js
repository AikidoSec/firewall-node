const t = require("tap");
const { execSync } = require("child_process");
const { resolve } = require("path");

const pathToApp = resolve(
  __dirname,
  "../../sample-apps/lambda-mark-unsafe",
  "app.js"
);

t.test(
  "it does not crash if markUnsafe is used in lambda wrapper",
  async (t) => {
    execSync(`node ${pathToApp}`, {
      env: { ...process.env, AIKIDO_DEBUG: "true", AIKIDO_BLOCKING: "true" },
    });
  }
);
