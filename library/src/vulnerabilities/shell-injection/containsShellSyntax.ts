const dangerousShellStrings = [
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
];

// Just whitespace characters alone are not dangerous
// They can occur in user input without posing a threat.
// So a space might occur in the command and in the user input (being an exact match)
// But when a space is not standalone, it is dangerous, because the user input might start a new command or argument
const regexForNonStandaloneSpaces = /(\b[ \n])|(\b[ \n]\b)|([ \n]\b)/;

const alwaysDangerous = [
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
];

const dangerousInCombination = [
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

export function containsShellSyntax(userInput: string): boolean {
  if (
    dangerousShellStrings.some((shellString) => userInput.includes(shellString))
  ) {
    return true;
  }

  if (alwaysDangerous.some((command) => userInput.includes(command))) {
    return true;
  }

  return regexForNonStandaloneSpaces.test(userInput);
}
