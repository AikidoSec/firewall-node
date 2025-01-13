import * as t from "tap";
import { toWinPathIfWin } from "./toWinPathIfWin";

t.test("it works", async (t) => {
  const samplePath =
    "/Users/aikido/Projects/sec/node_modules/mysql/lib/Connection.js";

  if (process.platform === "win32") {
    t.equal(toWinPathIfWin(samplePath), samplePath.replace(/\//g, "\\"));
  } else {
    t.equal(toWinPathIfWin(samplePath), samplePath);
  }
});
