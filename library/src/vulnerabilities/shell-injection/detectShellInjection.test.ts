import * as t from "tap";
import { detectShellInjection } from "./detectShellInjection";
import { quote } from "shell-quote";

t.test("it single characters are ignored", async () => {
  isNotShellInjection("ls `", "`");
  isNotShellInjection("ls *", "*");
  isNotShellInjection("ls a", "a");
});

t.test(
  "it does not detect shell injection when there is no user input",
  async () => {
    isNotShellInjection("ls", "");
    isNotShellInjection("ls", " ");
    isNotShellInjection("ls", "  ");
    isNotShellInjection("ls", "   ");
  }
);

t.test(
  "it does not detect shell injection if the user input does not occur in the command",
  async () => {
    isNotShellInjection("ls", "$(echo)");
  }
);

t.test("it detects $(command)", async () => {
  isShellInjection(`ls $(echo)`, "$(echo)");
  isShellInjection(`ls "$(echo)"`, "$(echo)");
  isShellInjection(
    `echo $(echo "Inner: $(echo "This is nested")")`,
    `$(echo "Inner: $(echo "This is nested")")`
  );

  isNotShellInjection(`ls '$(echo)'`, "$(echo)");
  isNotShellInjection(
    `ls '$(echo "Inner: $(echo "This is nested")")'`,
    `$(echo "Inner: $(echo "This is nested")")`
  );
});

t.test("it detects `command`", async () => {
  isShellInjection("echo `echo`", "`echo`");
});

t.test("it checks unsafely quoted", async () => {
  isShellInjection(`ls '$(echo)`, "$(echo)");
});

t.test("it ignores escaped backticks", async () => {
  const domain = "www.example`whoami`.com";
  const args = ["--domain", domain];
  isNotShellInjection(`binary ${quote(args)}`, domain);
});

t.test("it does not allow special chars inside double quotes", async () => {
  isShellInjection(`ls "whatever$"`, "whatever$");
  isShellInjection(`ls "whatever!"`, "whatever!");
  isShellInjection(`ls "whatever\\"`, "whatever\\");
  isShellInjection(`ls "whatever\`"`, "whatever`");
});

function isShellInjection(command: string, userInput: string) {
  t.same(
    detectShellInjection(command, userInput, "/bin/bash"),
    true,
    `command: ${command}, userInput: ${userInput}`
  );
}

function isNotShellInjection(command: string, userInput: string) {
  t.same(
    detectShellInjection(command, userInput, "/bin/bash"),
    false,
    `command: ${command}, userInput: ${userInput}`
  );
}
