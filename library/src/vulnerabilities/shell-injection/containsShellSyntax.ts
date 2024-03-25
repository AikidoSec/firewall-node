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

export function containsShellSyntax(userInput: string): boolean {
  if (
    dangerousShellStrings.some((shellString) => userInput.includes(shellString))
  ) {
    return true;
  }

  return regexForNonStandaloneSpaces.test(userInput);
}
