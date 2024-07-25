import { getCurrentAndNextSegments } from "../../helpers/getCurrentAndNextSegments";

const serverSideJsFunctions = ["$where", "$accumulator", "$function"];

export function detectDbJsInjection(
  userInput: string,
  filterPart: Record<string, unknown>
): boolean {
  if (userInput.length < 1) {
    // We ignore single characters since they don't pose a big threat.
    return false;
  }

  for (const [key, value] of Object.entries(filterPart)) {
    if (serverSideJsFunctions.includes(key)) {
      // Todo check functions
      if (typeof value !== "string") {
        continue;
      }

      // We ignore cases where the user input is longer than the command.
      // Because the user input can't be part of the command.
      if (userInput.length > value.length) {
        continue;
      }

      // User input is not part of the command
      if (!value.includes(userInput)) {
        continue;
      }

      // User input is safely encapsulated
      if (isSafelyEncapsulated(value, userInput)) {
        continue;
      }

      return true;
    }
  }

  return false;
}

const escapeChars = ['"', "'"];

/**
 * Check if the user input is safely encapsulated in the query
 */
function isSafelyEncapsulated(filterString: string, userInput: string) {
  return getCurrentAndNextSegments(filterString.split(userInput)).every(
    ({ currentSegment, nextSegment }) => {
      const charBeforeUserInput = currentSegment.slice(-1);
      const charAfterUserInput = nextSegment.slice(0, 1);

      const isEscapeChar = escapeChars.find(
        (char) => char === charBeforeUserInput
      );

      if (!isEscapeChar) {
        return false;
      }

      if (charBeforeUserInput !== charAfterUserInput) {
        return false;
      }

      if (userInput.includes(charBeforeUserInput)) {
        return false;
      }

      return true;
    }
  );
}
