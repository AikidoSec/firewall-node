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

const commandsRegex = new RegExp(
  `((${pathPrefixes.map(escapeStringRegexp).join("|")})?(${commands.join("|")}))`,
  "g"
);

function matchAll(str: string, regex: RegExp) {
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

  if (command === userInput && commands.find((c) => c === userInput)) {
    return true;
  }

  for (const match of matchAll(command, commandsRegex)) {
    if (!commandsRegex.test(userInput)) {
      continue;
    }

    const charBefore = command[match.index - 1];
    const charAfter = command[match.index + match[0].length];

    if (separators.includes(charBefore) && separators.includes(charAfter)) {
      return true;
    }

    if (separators.includes(charBefore) && charAfter === undefined) {
      return true;
    }

    if (charBefore === undefined && separators.includes(charAfter)) {
      return true;
    }
  }

  return false;
}
