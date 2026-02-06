import * as t from "tap";
import { isUnsupportedShell } from "./isUnsupportedShell";

t.test("true (Node.js default /bin/sh) is allowed", async () => {
  t.equal(isUnsupportedShell(true), false);
});

t.test("sh is allowed", async () => {
  t.equal(isUnsupportedShell("sh"), false);
});

t.test("/bin/sh is allowed", async () => {
  t.equal(isUnsupportedShell("/bin/sh"), false);
});

t.test("/bin/bash is unsupported", async () => {
  t.equal(isUnsupportedShell("/bin/bash"), true);
});

t.test("bash is unsupported", async () => {
  t.equal(isUnsupportedShell("bash"), true);
});

t.test("/bin/zsh is unsupported", async () => {
  t.equal(isUnsupportedShell("/bin/zsh"), true);
});

t.test("/usr/bin/zsh is unsupported", async () => {
  t.equal(isUnsupportedShell("/usr/bin/zsh"), true);
});

t.test("/usr/bin/fish is unsupported", async () => {
  t.equal(isUnsupportedShell("/usr/bin/fish"), true);
});
