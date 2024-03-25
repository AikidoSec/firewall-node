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

const separatorsCharacterRange = `[${separators.map(escapeStringRegexp).join("")}]`;

const parts = [
  `(${dangerousChars.map(escapeStringRegexp).join("|")})`,
  `((?<=${separatorsCharacterRange})(${pathPrefixes.map(escapeStringRegexp).join("|")})?(${commands.join("|")}))(?=${separatorsCharacterRange})`,
];

const shellSyntaxRegex = new RegExp(`(${parts.join("|")})`, "g");
console.log(shellSyntaxRegex);

export function containsShellSyntax(userInput: string): boolean {
  return shellSyntaxRegex.test(userInput);
}
