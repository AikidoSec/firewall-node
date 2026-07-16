import * as t from "tap";
import { colorText } from "./colorText";

t.beforeEach(() => {
  delete process.env.NO_COLOR;
  delete process.env.FORCE_COLOR;
});

t.test(
  "it returns red text with ANSI codes when color is supported",
  async () => {
    process.env.FORCE_COLOR = "1";

    t.equal(colorText("red", "hello"), "\x1b[31mhello\x1b[0m");
  }
);

t.test("it returns plain text when NO_COLOR is set", async () => {
  process.env.NO_COLOR = "";

  t.equal(colorText("red", "hello"), "hello");
});

t.test("it returns plain text when FORCE_COLOR is 0", async () => {
  process.env.FORCE_COLOR = "0";

  t.equal(colorText("red", "hello"), "hello");
});

t.test("it returns colored text when FORCE_COLOR is 1", async () => {
  process.env.FORCE_COLOR = "1";

  t.equal(colorText("red", "hello"), "\x1b[31mhello\x1b[0m");
});

t.test("it returns plain text when not a TTY and no FORCE_COLOR", async () => {
  const origIsTTY = process.stdout.isTTY;
  process.stdout.isTTY = false;

  t.equal(colorText("red", "hello"), "hello");

  process.stdout.isTTY = origIsTTY;
});
