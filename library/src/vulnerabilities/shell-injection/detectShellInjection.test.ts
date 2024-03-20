import * as t from "tap";
import { detectShellInjection } from "./detectShellInjection";

t.test("it detects shell injections", async () => {
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
