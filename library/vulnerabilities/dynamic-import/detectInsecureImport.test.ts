import * as t from "tap";
import { detectInsecureImport } from "./detectInsecureImport";

t.test("it detects insecure imports", async (t) => {
  t.equal(detectInsecureImport("http", "http"), true);
  t.equal(detectInsecureImport("../test.js", "../test.js"), true);
  t.equal(detectInsecureImport("../test.js", "../test"), true);
  t.equal(detectInsecureImport("/tmp/eval.js", "/tmp/eval.js"), true);

  t.equal(detectInsecureImport("http", "ht"), false);
  t.equal(detectInsecureImport("http", "https"), false);
  t.equal(detectInsecureImport("a", "a"), false);
  t.equal(detectInsecureImport("abc", "xyz"), false);
  t.equal(detectInsecureImport("/tmp/eval.js", "eval.js"), false);
});
