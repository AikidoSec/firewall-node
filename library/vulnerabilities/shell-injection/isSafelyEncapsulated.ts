import { getCurrentAndNextSegments } from "../../helpers/getCurrentAndNextSegments";

const escapeChars = ['"', "'"];
const dangerousCharsInsideDoubleQuotes = ["$", "`", "\\", "!"];

export function isSafelyEncapsulated(command: string, userInput: string) {
  return getCurrentAndNextSegments(command.split(userInput)).every(
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

      // There are no dangerous characters inside single quotes
      // You can use certain characters inside double quotes
      // https://www.gnu.org/software/bash/manual/html_node/Single-Quotes.html
      // https://www.gnu.org/software/bash/manual/html_node/Double-Quotes.html
      if (
        isEscapeChar === '"' &&
        dangerousCharsInsideDoubleQuotes.some((char) =>
          userInput.includes(char)
        )
      ) {
        return false;
      }

      if (
        includesBothSingleAndDoubleQuotes(currentSegment) &&
        includesBothSingleAndDoubleQuotes(nextSegment) &&
        includesEscapeChar(userInput)
      ) {
        console.log(currentSegment);
        console.log(nextSegment);
        return false;
      }

      return true;
    }
  );
}

function includesEscapeChar(toCheck: string) {
  return escapeChars.some((char) => toCheck.includes(char));
}

function includesBothSingleAndDoubleQuotes(toCheck: string) {
  return toCheck.includes("'") && toCheck.includes('"');
}
