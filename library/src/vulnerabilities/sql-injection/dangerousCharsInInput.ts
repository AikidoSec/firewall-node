import { SQL_DANGEROUS_IN_STRING } from "./config";

const dangerousInStringRegex = new RegExp(
  SQL_DANGEROUS_IN_STRING.join("|"),
  "im"
);

/**
 * This function is the second step to determine if an SQL Injection is happening,
 * If the user input contains characters that should never end up in a query, not
 * even in a string, this function returns true.
 * @param userInput The user input you want to check
 * @returns True if characters are present
 */
export function dangerousCharsInInput(userInput: string): boolean {
  return dangerousInStringRegex.test(userInput);
}
