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

      if (
        isEscapeChar === '"' &&
        dangerousCharsInsideDoubleQuotes.some((char) =>
          userInput.includes(char)
        )
      ) {
        return false;
      }

      return true;
    }
  );
}
