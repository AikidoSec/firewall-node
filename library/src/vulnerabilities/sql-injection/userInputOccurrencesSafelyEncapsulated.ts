import { SQL_STRING_CHARS } from "./config";

/**
 * This function is the third step to determine if an SQL Injection is happening,
 * This checks if **all** occurrences of our input are encapsulated as strings.
 * @param query The SQL Statement
 * @param userInput The user input you want to check is encapsulated
 * @returns True if the input is always encapsulated inside a string
 */
export function userInputOccurrencesSafelyEncapsulated(
  query: string,
  userInput: string
) {
  const queryWithoutUserInput = query.split(userInput);
  for (let i = 0; i + 1 < queryWithoutUserInput.length; i++) {
    const segment = queryWithoutUserInput[i];

    // Get the last character of this segment
    const lastChar = segment.slice(-1);

    if (!SQL_STRING_CHARS.includes(lastChar)) {
      return false; // If the character is not one of these, it's not a string.
    }

    const nextSegment = queryWithoutUserInput[i + 1];

    // Get the first character of the next segment
    const firstCharNext = nextSegment.slice(0, 1);

    if (lastChar != firstCharNext) {
      return false; // String is not encapsulated by the same type of quotes.
    }
  }

  return true;
}
