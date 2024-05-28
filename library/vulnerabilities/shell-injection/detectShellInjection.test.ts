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

t.test("user input is longer than the command", async () => {
  isNotShellInjection("`ls`", "`ls` `ls`");
});

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

t.test("single quote between single quotes", async () => {
  isShellInjection(`ls ''single quote''`, "'single quote'");
});

t.test("it ignores escaped backticks", async () => {
  const domain = "www.example`whoami`.com";
  const args = ["--domain", domain];
  isNotShellInjection(`binary ${quote(args)}`, domain);
});

t.test("it does not allow special chars inside double quotes", async () => {
  isShellInjection(`ls "whatever$"`, "whatever$");
  isShellInjection(`ls "whatever!"`, "whatever!");
  isShellInjection(`ls "whatever\`"`, "whatever`");
});

t.test("it does not allow semi", async () => {
  isShellInjection(`ls whatever;`, "whatever;");

  isNotShellInjection(`ls "whatever;"`, "whatever;");
  isNotShellInjection(`ls 'whatever;'`, "whatever;");
});

t.test("rm rf executed by using semi colon", async () => {
  isShellInjection(`ls; rm -rf`, "; rm -rf");
});

t.test("rm rf is flagged as shell injection", async () => {
  isShellInjection(`rm -rf`, "rm -rf");
});

t.test(
  "it detects shell injection with chained commands using &&",
  async () => {
    isShellInjection("ls && rm -rf /", "&& rm -rf /");
  }
);

t.test("it detects shell injection with OR logic using ||", async () => {
  isShellInjection("ls || echo 'malicious code'", "|| echo 'malicious code'");
});

t.test("it detects redirection attempts", async () => {
  isShellInjection("ls > /dev/null", "> /dev/null");
  isShellInjection("cat file.txt > /etc/passwd", "> /etc/passwd");
});

t.test("it detects append redirection attempts", async () => {
  isShellInjection("echo 'data' >> /etc/passwd", ">> /etc/passwd");
});

t.test("it detects pipe character as potential shell injection", async () => {
  isShellInjection("cat file.txt | grep 'password'", "| grep 'password'");
});

t.test("it allows safe use of pipe character within quotes", async () => {
  isNotShellInjection("echo '|'", "|");
});

t.test("it detects nested command substitution", async () => {
  isShellInjection(`echo $(cat $(ls))`, `$(cat $(ls))`);
});

t.test("it allows safe commands within single quotes", async () => {
  isNotShellInjection("echo 'safe command'", "safe command");
});

t.test("it detects unsafe use of variables", async () => {
  isShellInjection("echo $USER", "$USER");
  isShellInjection("echo ${USER}", "${USER}");
  isShellInjection('echo "${USER}"', "${USER}");
});

t.test("it allows safe use of variables within quotes", async () => {
  isNotShellInjection("echo '$USER'", "$USER");
});

t.test(
  "it detects subshell execution within backticks inside double quotes",
  async () => {
    isShellInjection(`ls "$(echo \`whoami\`)"`, "`whoami`");
  }
);

t.test("it detects code injection with newline characters", async () => {
  isShellInjection("echo 'safe'\necho 'malicious'", "\necho 'malicious'");
});

t.test("it detects attempts to escape out of quotes", async () => {
  isShellInjection('echo "safe"; echo "malicious"', '"; echo "malicious"');
});

t.test("it correctly handles whitespace in inputs", async () => {
  isNotShellInjection("ls", "   ");
  isShellInjection("ls ; rm -rf /", "; rm -rf /");
});

t.test("it detects file manipulation commands", async () => {
  isShellInjection("touch /tmp/malicious", "touch /tmp/malicious");
  isShellInjection(
    "mv /tmp/safe /tmp/malicious",
    "mv /tmp/safe /tmp/malicious"
  );
});

t.test(
  "allows commands with constants that resemble user input but are safely encapsulated",
  async () => {
    isNotShellInjection("echo 'userInput'", "userInput");
  }
);

t.test(
  "recognizes safe paths that include patterns similar to user input",
  async () => {
    isNotShellInjection(
      "ls /constant/path/without/user/input/",
      "/constant/path/without/user/input/"
    );
  }
);

t.test(
  "acknowledges safe use of special characters when properly encapsulated",
  async () => {
    isNotShellInjection('echo ";"', ";");
    isNotShellInjection('echo "&&"', "&&");
    isNotShellInjection('echo "||"', "||");
  }
);

t.test("treats encapsulated redirection and pipe symbols as safe", async () => {
  isNotShellInjection("echo 'data > file.txt'", "data > file.txt");
  isNotShellInjection("echo 'find | grep'", "find | grep");
});

t.test(
  "recognizes safe inclusion of special patterns within quotes as non-injections",
  async () => {
    isNotShellInjection("echo '$(command)'", "$(command)");
  }
);

t.test(
  "considers constants with semicolons as safe when clearly non-executable",
  async () => {
    isNotShellInjection("echo 'text; more text'", "text; more text");
  }
);

t.test(
  "acknowledges commands that look dangerous but are actually safe due to quoting",
  async () => {
    isNotShellInjection("echo '; rm -rf /'", "; rm -rf /");
    isNotShellInjection("echo '&& echo malicious'", "&& echo malicious");
  }
);

t.test(
  "recognizes commands with newline characters as safe when encapsulated",
  async () => {
    isNotShellInjection("echo 'line1\nline2'", "line1\nline2");
  }
);

t.test(
  "accepts special characters in constants as safe when they do not lead to command execution",
  async () => {
    isNotShellInjection("echo '*'", "*");
    isNotShellInjection("echo '?'", "?");
    isNotShellInjection("echo '\\' ", "\\");
  }
);

t.test(
  "does not flag command with matching whitespace as injection",
  async () => {
    isNotShellInjection("ls -l", " "); // A single space is just an argument separator, not user input
  }
);

t.test("ignores commands where multiple spaces match user input", async () => {
  isNotShellInjection("ls   -l", "   "); // Multiple spaces between arguments should not be considered injection
});

t.test(
  "does not consider leading whitespace in commands as user input",
  async () => {
    isNotShellInjection("  ls -l", "  "); // Leading spaces before the command are not user-controlled
  }
);

t.test("treats trailing whitespace in commands as non-injection", async () => {
  isNotShellInjection("ls -l ", " "); // Trailing space after the command is benign
});

t.test("recognizes spaces between quotes as non-injective", async () => {
  isNotShellInjection("echo ' ' ", " "); // Space within quotes is part of the argument, not a separator
});

t.test("handles spaces within quoted arguments correctly", async () => {
  isNotShellInjection("command 'arg with spaces'", " "); // Spaces within a quoted argument should not be flagged
});

t.test("correctly interprets spaces in mixed argument types", async () => {
  isNotShellInjection("command arg1 'arg with spaces' arg2", " "); // Mixed argument types with internal spaces are safe
});

t.test("ignores spaces in commands with concatenated arguments", async () => {
  isNotShellInjection("command 'arg1'arg2'arg3'", " "); // Lack of spaces in concatenated arguments is intentional and safe
});

t.test("does not flag spaces in commands with no arguments", async () => {
  isNotShellInjection("command", " "); // No arguments mean spaces are irrelevant
});

t.test(
  "considers spaces in environment variable assignments as safe",
  async () => {
    isNotShellInjection("ENV_VAR='value' command", " "); // Spaces around environment variable assignments are not injections
  }
);

t.test("new lines in commands are considered injections", async () => {
  isShellInjection("ls \nrm", "\nrm");
  isShellInjection("ls \nrm -rf", "\nrm -rf");
});

t.test("new lines alone are not considered injections", async () => {
  isNotShellInjection("ls\n\n", "\n\n");
});

t.test("certain commands are always flagged as dangerous", async () => {
  isShellInjection("/bin/rm -rf", "/bin/rm -rf");
  isShellInjection("rm -rf", "rm -rf");
  isShellInjection("rm -rf /", "rm -rf /");
  isShellInjection("sleep 10", "sleep 10");
  isShellInjection("sleep 10 &", "sleep 10 &");
  isShellInjection("shutdown -h now", "shutdown -h now");
  isShellInjection("halt", "halt");
  isShellInjection("poweroff", "poweroff");
  isShellInjection("reboot", "reboot");
  isShellInjection("reboot -f", "reboot -f");
  isShellInjection("ifconfig", "ifconfig");
  isShellInjection("ifconfig -a", "ifconfig -a");
  isShellInjection("kill", "kill");
  isShellInjection("killall", "killall");
  isShellInjection("killall -9", "killall -9");
  isShellInjection("chmod", "chmod");
  isShellInjection("chmod 777", "chmod 777");
  isShellInjection("chown", "chown");
  isShellInjection("chown root", "chown root");
});

t.test("rm being part of other commands", async () => {
  isShellInjection(
    `find /path/to/search -type f -name "pattern" | xargs rm`,
    "rm"
  );
  isShellInjection(
    `find /path/to/search -type f -name "pattern" -exec rm {} \\;`,
    "rm"
  );
  isShellInjection("ls .|rm", "rm");
});

t.test(
  "it ignores dangerous commands if they are part of a string",
  async () => {
    isNotShellInjection("binary sleepwithme", "sleepwithme");
    isNotShellInjection("binary rm-rf", "rm-rf");
    isNotShellInjection("term", "term");
    isNotShellInjection("rm /files/rm.txt", "rm.txt");
  }
);

t.test(
  "it does not flag domain name as argument unless it contains backticks",
  async () => {
    isNotShellInjection("binary --domain www.example.com", "www.example.com");
    isNotShellInjection(
      "binary --domain https://www.example.com",
      "https://www.example.com"
    );

    isShellInjection(
      "binary --domain www.example`whoami`.com",
      "www.example`whoami`.com"
    );
    isShellInjection(
      "binary --domain https://www.example`whoami`.com",
      "https://www.example`whoami`.com"
    );
  }
);

t.test("it flags colon if used as a command", async () => {
  isShellInjection(":|echo", ":|");
  isShellInjection(":| echo", ":|");
  isShellInjection(": | echo", ": |");
});

t.test("it flags ../ as dangerous", async () => {
  isShellInjection("ls ../", "../");
  isShellInjection("ls ../../", "../../");
  isShellInjection("ls ../../../", "../../../");
  isShellInjection("ls ../../../../", "../../../../");
});

t.test("it flags quoted ../ as dangerous", async () => {
  isShellInjection("ls '../'", "../");
  isShellInjection("ls '../../'", "../../");
  isShellInjection("ls '../../../'", "../../../");
  isShellInjection("ls '../../../../'", "../../../../");
});

t.test("it does not flag if ../ is not in user input", async () => {
  isNotShellInjection("ls", "../");
  isNotShellInjection("ls ../", "hello");
});

function isShellInjection(command: string, userInput: string) {
  t.same(
    detectShellInjection(command, userInput),
    true,
    `command: ${command}, userInput: ${userInput}`
  );
}

function isNotShellInjection(command: string, userInput: string) {
  t.same(
    detectShellInjection(command, userInput),
    false,
    `command: ${command}, userInput: ${userInput}`
  );
}
