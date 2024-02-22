import { Agent } from "../../agent/Agent";
import { Context } from "../../agent/Context";
import { Source, friendlyName } from "../../agent/Source";
import { extract } from "../../helpers/extractStringsFromObjects";

/* We make use of double backslashes to create a single backslash in the RegEx
 * SQL Operators : = ! ; + - * / % & | ^ > <
 * Dangerous characters in strings : \ ' " ` /* --
 */
import {
  SQL_KEYWORDS,
  SQL_OPERATORS,
  SQL_DANGEROUS_IN_STRING,
  SQL_STRING_CHARS,
} from "./config.json";

/**
 * This function executes 2 checks to see if something is or is not an SQL Injection :
 * Step 2 : queryContainsUserInput
 * 2. Executes queryContainsUserInput() - This checks wether the input is in the sql
 * @param query The SQL Statement that's going to be executed
 * @param userInput The user input that might be dangerous
 * @returns True if SQL Injection is detected
 */
export function detectSQLInjection(query: string, userInput: string) {
  if(userInput.length <= 1) {
    // We ignore single characters since they are only able to crash the SQL Server,
    // And don't pose a big cybersecurity threat.
    return false;
  }
  if (!queryContainsUserInput(query, userInput)) {
    // If the user input is not part of the query, return false (No need to check)
    return false;
  }
  if (dangerousCharsInInput(userInput)) {
    // If the user input contains characters that are dangerous in every context :
    // Encapsulated or not, return true (No need to check any further)
    return true;
  }
  if (userInputOccurrencesSafelyEncapsulated(query, userInput)) {
    // If the user input is safely encapsulated as a string in the query
    // We can ignore it and return false (i.e. not an injection)
    return false;
  }
  // Executing our final check with the massive RegEx :
  return userInputContainsSQLsyntax(userInput);
}

// Declare Regexes
const dangerousInStringRegex = new RegExp(
  SQL_DANGEROUS_IN_STRING.join("|"),
  "im"
);
const possibleSqlRegex = new RegExp(
  "(?<![a-z])(" +
    SQL_KEYWORDS.join("|") +
    ")(?![a-z])|(" +
    SQL_OPERATORS.join("|") +
    ")|(?<=([\\s|.|" +
    SQL_OPERATORS.join("|") +
    "]|^)+)([a-z0-9_-]+)(?=[\\s]*\\()",
  "im"
);

/**
 * This function is the first check in order to determine if a SQL injection is happening,
 * If the user input contains the necessary characters or words for a SQL injection, this
 * function returns true.
 * @param userInput The user input you want to check
 * @returns True when this is a posible SQL Injection
 */
export function userInputContainsSQLsyntax(userInput: string): boolean {
  return possibleSqlRegex.test(userInput);
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
 * This function is the second step to determine if an SQL Injection is happening,
 * If the user input contains characters that should never end up in a query, not
 * even in a string, this function returns true.
 * @param userInput The user input you want to check
 * @returns True if characters are present
 */
export function dangerousCharsInInput(userInput: string): boolean {
  return dangerousInStringRegex.test(userInput);
}

/**
 * This function is the third step to determine if an SQL Injection is happening,
 * This checks if **all** occurences of our input are encapsulated as strings.
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
    // Get the last character of this segment
    const lastChar = queryWithoutUserInput[i].slice(-1);
    // Get the first character of the next segment
    const firstCharNext = queryWithoutUserInput[i + 1].slice(0, 1);

    if (!SQL_STRING_CHARS.includes(lastChar)) {
      return false; // If the character is not one of these, it's not a string.
    }
    if (lastChar != firstCharNext) {
      return false; // String is not encapsulated by the same type of quotes.
    }
  }
  return true;
}

/**
 * This function goes over all the different input types in the context and checks
 * if it's a possible SQL Injection, if so the function messages an Agent and if
 * needed, throws an error to block any further code.
 * @param sql The SQL statement that was executed
 * @param request The request that might contain a SQL Injection
 * @param agent The agent which needs to get a report in case of detection
 * @param module The name of the module e.g. postgres, mysql, mssql
 */
export function checkContextForSqlInjection(
  sql: string,
  request: Context,
  agent: Agent,
  module: string
) {
  // Currently, do nothing : Still needs to be implemented
  for (const source of ["body", "query", "headers", "cookies"] as Source[]) {
    if (request[source]) {
      const userInput = extract(request[source]);
      for (let i = 0; i < userInput.length; i++) {
        if (detectSQLInjection(sql, userInput[i])) {
          agent.onDetectedAttack({
            module,
            kind: "sql_injection",
            blocked: agent.shouldBlock(),
            source,
            request: request,
            stack: new Error().stack || "",
            path: "UNKOWN",
            metadata: {},
          });

          if (agent.shouldBlock()) {
            throw new Error(
              `Aikido guard has blocked a SQL injection: ${userInput[i]} originating from ${friendlyName(source)}`
            );
          }
        }
      }
    }
  }
}
