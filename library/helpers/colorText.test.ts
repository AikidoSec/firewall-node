import * as t from "tap";
import { colorText } from "./colorText";

t.test(
  "it returns red text with ANSI codes when color is supported",
  async () => {
    const prev = { ...process.env };
    delete process.env.NO_COLOR;
    process.env.FORCE_COLOR = "1";

    t.equal(colorText("red", "hello"), "\x1b[31mhello\x1b[0m");

    process.env = prev;
  }
);

t.test("it returns plain text when NO_COLOR is set", async () => {
  const prev = { ...process.env };
  process.env.NO_COLOR = "";

  t.equal(colorText("red", "hello"), "hello");

  process.env = prev;
});

t.test("it returns plain text when FORCE_COLOR is 0", async () => {
  const prev = { ...process.env };
  delete process.env.NO_COLOR;
  process.env.FORCE_COLOR = "0";

  t.equal(colorText("red", "hello"), "hello");

  process.env = prev;
});

t.test("it returns colored text when FORCE_COLOR is 1", async () => {
  const prev = { ...process.env };
  delete process.env.NO_COLOR;
  process.env.FORCE_COLOR = "1";

  t.equal(colorText("red", "hello"), "\x1b[31mhello\x1b[0m");

  process.env = prev;
});

t.test("it returns plain text when not a TTY and no FORCE_COLOR", async () => {
  const prev = { ...process.env };
  delete process.env.NO_COLOR;
  delete process.env.FORCE_COLOR;

  const origIsTTY = process.stdout.isTTY;
  process.stdout.isTTY = false;

  t.equal(colorText("red", "hello"), "hello");

  process.stdout.isTTY = origIsTTY;
  process.env = prev;
});
