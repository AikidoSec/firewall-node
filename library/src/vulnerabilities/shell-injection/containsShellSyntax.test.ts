import * as t from "tap";
import { containsShellSyntax } from "./containsShellSyntax";

t.test("it detects shell syntax", async (t) => {
  t.same(containsShellSyntax(""), false);
  t.same(containsShellSyntax("hello"), false);
  t.same(containsShellSyntax("\n"), false);
  t.same(containsShellSyntax("\n\n"), false);

  t.same(containsShellSyntax("$(command)"), true);
  t.same(containsShellSyntax("$(command arg arg)"), true);
  t.same(containsShellSyntax("`command`"), true);
  t.same(containsShellSyntax("\narg"), true);
  t.same(containsShellSyntax("\narg\n"), true);
  t.same(containsShellSyntax("arg\n"), true);
  t.same(containsShellSyntax("arg\narg"), true);
  t.same(containsShellSyntax("rm -rf"), true);
});
