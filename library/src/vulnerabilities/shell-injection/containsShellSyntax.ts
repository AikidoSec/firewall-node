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

const regexForNonStandaloneSpaces = /(\b )|(\b \b)|( \b)/;

export function containsShellSyntax(userInput: string): boolean {
  if (
    dangerousShellStrings.some((shellString) => userInput.includes(shellString))
  ) {
    return true;
  }

  return regexForNonStandaloneSpaces.test(userInput);
}
