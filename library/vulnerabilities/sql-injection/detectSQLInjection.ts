import { SQLDialect } from "./dialects/SQLDialect";
import { queryContainsUserInput } from "./queryContainsUserInput";
import { userInputContainsSQLSyntax } from "./userInputContainsSQLSyntax";
import { userInputOccurrencesSafelyEncapsulated } from "./userInputOccurrencesSafelyEncapsulated";

export function detectSQLInjection(
  query: string,
  userInput: string,
  dialect: SQLDialect
) {
  if (userInput.length <= 1) {
    // We ignore single characters since they are only able to crash the SQL Server,
    // And don't pose a big threat.
    return false;
  }

  if (!queryContainsUserInput(query, userInput)) {
    // If the user input is not part of the query, return false (No need to check)
    return false;
  }

  if (userInputOccurrencesSafelyEncapsulated(query, userInput)) {
    return false;
  }

  // Executing our final check with the massive RegEx
  return userInputContainsSQLSyntax(userInput, dialect);
}
