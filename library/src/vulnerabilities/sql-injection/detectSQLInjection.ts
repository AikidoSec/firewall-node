import { Context } from "../../agent/Context";
import { InterceptorResult } from "../../agent/hooks/MethodInterceptor";
import { Source } from "../../agent/Source";
import { extractStringsFromUserInput } from "../../helpers/extractStringsFromUserInput";
import { findAllOccurrences } from "../../helpers/findAllOccurrences";
import { dangerousCharsInInput } from "./dangerousCharsInInput";
import { SQLDialect } from "./dialect/SQLDialect";
import { userInputContainsSQLSyntax } from "./userInputContainsSQLSyntax";

/**
 * This function executes 2 checks to see if something is or is not an SQL Injection :
 * Step 2 : queryContainsUserInput
 * 2. Executes queryContainsUserInput() - This checks whether the input is in the sql
 */
export function detectSQLInjection(
  sql: string,
  userInput: string,
  dialect: SQLDialect
) {
  if (userInput.length <= 1) {
    // We ignore single characters since they are only able to crash the SQL Server,
    // And don't pose a big threat.
    return false;
  }

  if (!queryContainsUserInput(sql, userInput)) {
    // If the user input is not part of the query, return false (No need to check)
    return false;
  }

  if (dangerousCharsInInput(userInput)) {
    // If the user input contains characters that are dangerous in every context :
    // Encapsulated or not, return true (No need to check any further)
    return true;
  }

  if (userInputOccurrencesSafelyEncapsulated(sql, userInput, dialect)) {
    // If the user input is safely encapsulated as a string in the query
    // We can ignore it and return false (i.e. not an injection)
    return false;
  }

  // Executing our final check with the massive RegEx :
  return userInputContainsSQLSyntax(userInput);
}

/**
 * This function is the first step to determine if an SQL Injection is happening,
 * If the sql statement contains user input, this function returns true (case-insensitive)
 * @param query The SQL Statement you want to check it against
 * @param userInput The user input you want to check
 * @returns True when the sql statement contains the input
 */
export function queryContainsUserInput(query: string, userInput: string) {
  const lowercaseSql = query.toLowerCase();
  const lowercaseInput = userInput.toLowerCase();

  return lowercaseSql.includes(lowercaseInput);
}

/**
 * This function is the third step to determine if an SQL Injection is happening,
 * This checks if **all** occurrences of our input are encapsulated as strings.
 */
export function userInputOccurrencesSafelyEncapsulated(
  sql: string,
  userInput: string,
  dialect: SQLDialect
) {
  const escapedRanges = dialect.getEscapedRanges(sql);

  return findAllOccurrences(sql, userInput).every(
    ([userInputStart, userInputEnd]) => {
      if (
        escapedRanges.some(
          ([startEscape, endEscape]) =>
            startEscape <= userInputStart && endEscape >= userInputEnd
        )
      ) {
        return true;
      }
    }
  );
}

/**
 * This function goes over all the different input types in the context and checks
 * if it's a possible SQL Injection, if so the function returns an InterceptorResult
 */
export function checkContextForSqlInjection({
  sql,
  operation,
  context,
  dialect,
}: {
  sql: string;
  operation: string;
  context: Context;
  dialect: SQLDialect;
}): InterceptorResult {
  for (const source of ["body", "query", "headers", "cookies"] as Source[]) {
    if (context[source]) {
      const userInput = extractStringsFromUserInput(context[source]);
      for (const str of userInput) {
        if (detectSQLInjection(sql, str, dialect)) {
          return {
            operation: operation,
            kind: "sql_injection",
            source: source,
            pathToPayload: "UNKOWN",
            metadata: {},
          };
        }
      }
    }
  }
}
