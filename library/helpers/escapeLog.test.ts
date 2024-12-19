import * as t from "tap";
import { escapeLog } from "./escapeLog";

t.test("it escapes log messages", async (t) => {
  t.equal(escapeLog("Hello\nWorld"), "Hello World");
  t.equal(escapeLog("Hello`World"), "Hello'World");
  t.equal(escapeLog("Hello\n`World"), "Hello 'World");
  t.equal(escapeLog("Hello`World\n"), "Hello'World ");
  t.equal(escapeLog('Hello "World"'), "Hello 'World'");
  t.equal(escapeLog(undefined), "");
});
