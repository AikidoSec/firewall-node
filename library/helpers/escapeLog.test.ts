import * as t from "tap";
import { escapeLog } from "./escapeLog";

t.test("it escapes log messages", async (t) => {
  t.equal(escapeLog("Hello\nWorld"), "Hello World");
  t.equal(escapeLog("Hello`World"), "Hello'World");
  t.equal(escapeLog("Hello\n`World"), "Hello 'World");
  t.equal(escapeLog("Hello`World\n"), "Hello'World ");
  t.equal(escapeLog('Hello "World"'), "Hello 'World'");
  t.equal(escapeLog(undefined), "");
  t.equal(escapeLog("Hello\rWorld"), "Hello World");
  t.equal(escapeLog("Hello\r\nWorld"), "Hello  World");
  t.equal(escapeLog("\x1b[31mred\x1b[0m"), " [31mred [0m");
  t.equal(escapeLog("a\x00b\x07c\x7fd\x85e"), "a b c d e");
  t.equal(escapeLog("a b c"), "a b c");
});

t.test("it replaces unicode bidirectional format controls", async (t) => {
  // Overrides, embeddings and pop directional formatting
  t.equal(escapeLog("a‮b‬c"), "a b c");
  t.equal(escapeLog("‪a‫b‭c"), " a b c");
  // Isolates
  t.equal(escapeLog("a⁦b⁧c⁨d⁩e"), "a b c d e");
  // Directional marks and Arabic letter mark
  t.equal(escapeLog("a‎b‏c؜d"), "a b c d");
});
