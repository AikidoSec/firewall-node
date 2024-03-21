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

export function containsShellSyntax(userInput: string): boolean {
  return dangerousShellStrings.some((shellString) =>
    userInput.includes(shellString)
  );
}
