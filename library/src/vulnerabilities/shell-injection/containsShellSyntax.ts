import { escapeStringRegexp } from "../../helpers/escapeStringRegexp";

const dangerousChars = [
  "#",
  "!",
  '"',
  "$",
  "&",
  "'",
  "(",
  ")",
  "*",
  ",",
  ":",
  ";",
  "<",
  "=",
  ">",
  "?",
  "@",
  "[",
  "\\",
  "]",
  "^",
  "`",
  "{",
  "|",
  "}",
  " ",
  "\n",
  "\t",
];

const commands = [
  "sleep",
  "shutdown",
  "reboot",
  "poweroff",
  "halt",
  "ifconfig",
  "chmod",
  "chown",
  "ping",
  "ssh",
  "scp",
  "curl",
  "wget",
  "telnet",
  "kill",
  "killall",
  "rm",
  "mv",
  "cp",
  "touch",
  "echo",
  "cat",
  "head",
  "tail",
  "grep",
  "find",
  "awk",
  "sed",
  "sort",
  "uniq",
  "wc",
];

const pathPrefixes = [
  "/bin/",
  "/sbin/",
  "/usr/bin/",
  "/usr/sbin/",
  "/usr/local/bin/",
  "/usr/local/sbin/",
];

const separators = [" ", "\t", "\n", ";", "&", "|", "(", ")", "<", ">"];

// "killall" should be matched before "kill"
function byLength(a: string, b: string) {
  return b.length - a.length;
}

const commandsRegex = new RegExp(
  `((${pathPrefixes.map(escapeStringRegexp).join("|")})?(${commands.slice().sort(byLength).join("|")}))`,
  "g"
);

function matchAll(str: string, regex: RegExp) {
  // Reset the regex so that the next call to `exec` starts from the beginning
  // As the regex is global, it will remember the last index
  regex.lastIndex = 0;

  const matches = [];
  let match;
  while ((match = regex.exec(str)) !== null) {
    matches.push(match);
  }

  return matches;
}

export function containsShellSyntax(
  command: string,
  userInput: string
): boolean {
  const allWhitespace = /^\s*$/.test(userInput);

  if (allWhitespace) {
    return false;
  }

  if (dangerousChars.find((c) => userInput.includes(c))) {
    return true;
  }

  if (command === userInput) {
    // Reset the regex so that the next call to `exec` starts from the beginning
    // As the regex is global, it will remember the last index
    commandsRegex.lastIndex = 0;
    const match = commandsRegex.exec(command);

    return match
      ? match.index === 0 && match[0].length === command.length
      : false;
  }

  // Check if the command contains a dangerous command
  for (const match of matchAll(command, commandsRegex)) {
    // If the command doesn't contain the user input, we can skip this match
    if (userInput !== match[0]) {
      continue;
    }

    // Check if the command is surrounded by separators
    // These separators are used to separate commands and arguments
    // e.g. `rm<space>-rf`
    // e.g. `ls<newline>whoami`
    // e.g. `echo<tab>hello`
    const charBefore = command[match.index - 1];
    const charAfter = command[match.index + match[0].length];

    // e.g. `<separator>rm<separator>`
    if (separators.includes(charBefore) && separators.includes(charAfter)) {
      return true;
    }

    // e.g. `<separator>rm`
    if (separators.includes(charBefore) && charAfter === undefined) {
      return true;
    }

    // e.g. `rm<separator>`
    if (charBefore === undefined && separators.includes(charAfter)) {
      return true;
    }
  }

  return false;
}
