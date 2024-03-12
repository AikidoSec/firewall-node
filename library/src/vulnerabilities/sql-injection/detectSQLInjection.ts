import { SQL_STRING_CHARS } from "./config";
import { queryContainsUserInput } from "./queryContainsUserInput";
import { userInputContainsSQLSyntax } from "./userInputContainsSQLSyntax";

export function detectSQLInjection(query: string, userInput: string) {
  if (userInput.length <= 1) {
    // We ignore single characters since they are only able to crash the SQL Server,
    // And don't pose a big threat.
    return false;
  }

  if (!queryContainsUserInput(query, userInput)) {
    // If the user input is not part of the query, return false (No need to check)
    return false;
  }

  const segmentsInBetween = getCurrentAndNextSegments(query.split(userInput));

  if (
    segmentsInBetween.length > 0 &&
    segmentsInBetween.every(({ currentSegment, nextSegment }) => {
      const lastChar = currentSegment.slice(-1);
      const nextChar = nextSegment.slice(0, 1);

      return (
        SQL_STRING_CHARS.includes(lastChar) &&
        lastChar === nextChar &&
        !userInput.includes(lastChar)
      );
    })
  ) {
    return false;
  }

  // Executing our final check with the massive RegEx
  return userInputContainsSQLSyntax(userInput);
}

function getCurrentAndNextSegments<T>(
  array: T[]
): { currentSegment: T; nextSegment: T }[] {
  return array
    .slice(0, -1)
    .map((currentItem, index) => ({
      currentSegment: currentItem,
      nextSegment: array[index + 1],
    }))
    .filter(
      ({ currentSegment, nextSegment }) =>
        currentSegment !== "" && nextSegment !== ""
    );
}
