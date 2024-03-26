import * as t from "tap";
import { containsShellSyntax } from "./containsShellSyntax";

t.test("it detects shell syntax", async (t) => {
  containsSyntax("", false);
  containsSyntax("hello", false);
  containsSyntax("\n", false);
  containsSyntax("\n\n", false);

  containsSyntax("$(command)", true);
  containsSyntax("$(command arg arg)", true);
  containsSyntax("`command`", true);
  containsSyntax("\narg", true);
  containsSyntax("\targ", true);
  containsSyntax("\narg\n", true);
  containsSyntax("arg\n", true);
  containsSyntax("arg\narg", true);
  containsSyntax("rm -rf", true);
  containsSyntax("/bin/rm -rf", true);
  containsSyntax("/bin/rm", true);
  containsSyntax("/sbin/sleep", true);
});

function containsSyntax(str: string, expected: boolean) {
  t.same(containsShellSyntax(str, str), expected, str);
}

t.test("it detects commands surrounded by separators", async (t) => {
  t.same(
    containsShellSyntax(
      `find /path/to/search -type f -name "pattern" -exec rm {} \\\\;`,
      "rm"
    ),
    true
  );
});

t.test("it detects commands with separator before", async (t) => {
  t.same(
    containsShellSyntax(
      `find /path/to/search -type f -name "pattern" | xargs rm`,
      "rm"
    ),
    true
  );
});

t.test("it detects commands with separator after", async (t) => {
  t.same(containsShellSyntax("rm arg", "rm"), true);
});

t.test("it checks if the same command occurs in the user input", async () => {
  t.same(containsShellSyntax("find cp", "rm"), false);
});
