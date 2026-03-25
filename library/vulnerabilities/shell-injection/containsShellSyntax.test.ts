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
  containsSyntax("/usr/bin/kill", true);
  containsSyntax("/usr/bin/killall", true);
  containsSyntax("/usr/bin/env", true);
  containsSyntax("/bin/ps", true);
  containsSyntax("/usr/bin/W", true);
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

t.test("it treats colon as a command", async () => {
  t.same(containsShellSyntax(":|echo", ":|"), true);
  t.same(
    containsShellSyntax("https://www.google.com", "https://www.google.com"),
    false
  );
});

t.test("it detects newline as separator", async () => {
  t.same(containsShellSyntax("ls\nrm", "rm"), true);
  t.same(containsShellSyntax("echo test\nrm -rf /", "rm"), true);
  t.same(containsShellSyntax("rm\nls", "rm"), true);
});

t.test("it detects tab as separator", async () => {
  t.same(containsShellSyntax("ls\trm", "rm"), true);
  t.same(containsShellSyntax("echo test\trm -rf /", "rm"), true);
  t.same(containsShellSyntax("rm\tls", "rm"), true);
});

t.test("it detects carriage return as separator", async () => {
  t.same(containsShellSyntax("ls\rrm", "rm"), true);
  t.same(containsShellSyntax("echo test\rrm -rf /", "rm"), true);
  t.same(containsShellSyntax("rm\rls", "rm"), true);
});

t.test("it detects form feed as separator", async () => {
  t.same(containsShellSyntax("ls\frm", "rm"), true);
  t.same(containsShellSyntax("echo test\frm -rf /", "rm"), true);
  t.same(containsShellSyntax("rm\fls", "rm"), true);
});

t.test("it flags input as shell injection", async () => {
  t.same(
    containsShellSyntax(
      "command -disable-update-check -target https://examplx.com|curl+https://cde-123.abc.domain.com+%23 -json-export /tmp/5891/8526757.json -tags microsoft,windows,exchange,iis,gitlab,oracle,cisco,joomla -stats -stats-interval 3 -retries 3 -no-stdin",
      "https://examplx.com|curl+https://cde-123.abc.domain.com+%23"
    ),
    true
  );
});
