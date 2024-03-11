import { SQL_DANGEROUS_IN_STRING } from "./config";
import { queryContainsUserInput } from "./queryContainsUserInput";
import { userInputContainsSQLSyntax } from "./userInputContainsSQLSyntax";
import { userInputOccurrencesSafelyEncapsulated } from "./userInputOccurrencesSafelyEncapsulated";

/**
 * This function executes 2 checks to see if something is or is not an SQL Injection :
 * Step 2 : queryContainsUserInput
 * 2. Executes queryContainsUserInput() - This checks whether the input is in the sql
 * @param query The SQL Statement that's going to be executed
 * @param userInput The user input that might be dangerous
 * @returns True if SQL Injection is detected
 */
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

  if (
    SQL_DANGEROUS_IN_STRING.some((dangerous) => userInput.includes(dangerous))
  ) {
    // If the user input is a dangerous string, return true (i.e. SQL Injection)
    return true;
  }

  if (userInputOccurrencesSafelyEncapsulated(query, userInput)) {
    // If the user input is safely encapsulated as a string in the query
    // We can ignore it and return false (i.e. not an injection)
    return false;
  }

  // Executing our final check with the massive RegEx :
  return userInputContainsSQLSyntax(userInput);
}
