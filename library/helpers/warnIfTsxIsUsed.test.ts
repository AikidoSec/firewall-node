import * as t from "tap";
import { warnIfTsxIsUsed } from "./warnIfTsxIsUsed";

const logs: string[] = [];
// oxlint-disable-next-line no-console
console.warn = function warn(message: string) {
  logs.push(message);
};

t.test("warnIfTsxIsUsed should warn when tsx is used", async (t) => {
  // Simulate tsx being used
  process.execArgv.push("node_modules/tsx");

  warnIfTsxIsUsed();

  t.match(logs, [
    "AIKIDO: You are using tsx to run your code. Zen might not fully protect your app when using tsx. In production you should always use node to run your code.",
  ]);

  // Clean up
  process.execArgv.pop();
  logs.length = 0;
});

t.test("warnIfTsxIsUsed should not warn when tsx is not used", async (t) => {
  warnIfTsxIsUsed();

  t.same(logs, []);
});
