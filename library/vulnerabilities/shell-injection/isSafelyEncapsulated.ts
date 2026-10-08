const dangerousCharsInsideDoubleQuotes = ["$", "`", "\\", "!"];

/**
 * Determines the shell quote state at a given position in a command string.
 * Returns the active quote character ('"' or "'") or null if not quoted.
 */
function getQuoteStateAt(command: string, position: number): string | null {
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let escaped = false;

  for (let i = 0; i < position; i++) {
    const char = command[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      // Backslash escapes the next character (except inside single quotes)
      if (!inSingleQuote) {
        escaped = true;
      }
      continue;
    }

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
    } else if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
    }
  }

  if (inSingleQuote) {
    return "'";
  }
  if (inDoubleQuote) {
    return '"';
  }
  return null;
}

export function isSafelyEncapsulated(command: string, userInput: string) {
  if (!command.includes(userInput)) {
    return true;
  }

  // Find all occurrences of userInput in command
  let index = command.indexOf(userInput);
  while (index !== -1) {
    const startPos = index;
    const endPos = index + userInput.length;

    // Check the quote state at the start of the user input
    const quoteState = getQuoteStateAt(command, startPos);

    // If not quoted, it's not safely encapsulated
    if (quoteState === null) {
      return false;
    }

    // Verify the quote state remains consistent throughout the user input
    // by checking that the quote state at the end is the same
    const endQuoteState = getQuoteStateAt(command, endPos);
    if (endQuoteState !== quoteState) {
      return false;
    }

    // If in single quotes, any content is safe (no escaping possible)
    // If in double quotes, check for dangerous characters
    if (quoteState === '"') {
      if (
        dangerousCharsInsideDoubleQuotes.some((char) =>
          userInput.includes(char)
        )
      ) {
        return false;
      }
    }

    // Check next occurrence
    index = command.indexOf(userInput, index + 1);
  }

  return true;
}
