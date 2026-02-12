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
  ";",
  "<",
  "=",
  ">",
  "?",
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
  "~",
  "\r",
  "\f",
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
  "ls",
  "env",
  "ps",
  "who",
  "whoami",
  "id",
  "w",
  "df",
  "du",
  "pwd",
  "uname",
  "hostname",
  "netstat",
  "passwd",
  "arch",
  "printenv",
  "logname",
  "pstree",
  "hostnamectl",
  "set",
  "lsattr",
  "killall5",
  "dmesg",
  "history",
  "free",
  "uptime",
  "finger",
  "top",
  "shopt",

  // Colon is a null command
  // it might occur in URLs that are passed as arguments to a binary
  // we should flag if it's surrounded by separators
  ":",
];

const pathPrefixes = [
  "/bin/",
  "/sbin/",
  "/usr/bin/",
  "/usr/sbin/",
  "/usr/local/bin/",
  "/usr/local/sbin/",
];

const separators = [
  " ",
  "\t",
  "\n",
  ";",
  "&",
  "|",
  "(",
  ")",
  "<",
  ">",
  "\r",
  "\f",
];

// "killall" should be matched before "kill"
function byLength(a: string, b: string) {
  return b.length - a.length;
}

const commandsRegex = new RegExp(
  `([/.]*(${pathPrefixes.map(escapeStringRegexp).join("|")})?(${commands.slice().sort(byLength).join("|")}))`,
  "gi"
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

  // The command is the same as the user input
  // Rare case, but it's possible
  // e.g. command is `shutdown` and user input is `shutdown`
  // (`shutdown -h now` will be caught by the dangerous chars as it contains a space)
  if (command === userInput) {
    // Reset the regex so that the next call to `exec` starts from the beginning
    // As the regex is global, it will remember the last index
    commandsRegex.lastIndex = 0;
    const match = commandsRegex.exec(command);

    return match
      ? match.index === 0 && match[0].length === command.length
      : false;
  }

  // Check if the command contains a commonly used command
  for (const match of matchAll(command, commandsRegex)) {
    // We found a command like `rm` or `/sbin/shutdown` in the command
    // Check if the command is the same as the user input
    // If it's not the same, continue searching
    if (userInput !== match[0]) {
      continue;
    }

    // Otherwise, we'll check if the command is surrounded by separators
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
