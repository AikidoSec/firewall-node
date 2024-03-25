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

// Just whitespace characters alone are not dangerous
// They can occur in user input without posing a threat.
// So a space might occur in the command and in the user input (being an exact match)
// But when a space is not standalone, it is dangerous, because the user input might start a new command or argument
const regexForNonStandaloneSpaces = /(\b[ \n])|(\b[ \n]\b)|([ \n]\b)/;

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

const separators = [
  " ",
  "\t",
  "\n",
  ";",
  "&",
  "|",
  "||",
  "&&",
  "(",
  ")",
  "<",
  ">",
];

const parts = [
  `(${dangerousChars.map(escapeStringRegexp).join("|")})`,
  `((${pathPrefixes.map(escapeStringRegexp).join("|")})?(${commands.join("|")}))`,
];

const shellSyntaxRegex = new RegExp(`(${parts.join("|")})`, "g");
console.log(shellSyntaxRegex);

export function containsShellSyntax(userInput: string): boolean {
  return shellSyntaxRegex.test(userInput);
}
