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
  containsSyntax("\narg\n", true);
  containsSyntax("arg\n", true);
  containsSyntax("arg\narg", true);
  containsSyntax("rm -rf", true);
});

function containsSyntax(str: string, expected: boolean) {
  t.same(containsShellSyntax(str), expected);
}
