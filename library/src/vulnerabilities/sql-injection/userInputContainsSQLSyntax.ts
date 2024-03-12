import { escapeStringRegexp } from "../../helpers/escapeStringRegexp";
import { SQL_DANGEROUS_IN_STRING, SQL_KEYWORDS, SQL_OPERATORS } from "./config";

const matchSqlKeywords =
  "(?<![a-z])(" + // Lookbehind : if the keywords are preceded by one or more letters, it should not match
  SQL_KEYWORDS.join("|") + // Look for SQL Keywords
  ")(?![a-z])"; // Lookahead : if the keywords are followed by one or more letters, it should not match

const matchSqlOperators = `(${SQL_OPERATORS.map(escapeStringRegexp).join("|")})`;

const matchSqlFunctions =
  "(?<=([\\s|.|" + // Lookbehind : A sql function should be preceded by spaces, dots,
  SQL_OPERATORS.map(escapeStringRegexp).join("|") + // Or sql operators
  "]|^)+)" +
  "([a-z0-9_-]+)" + // The name of a sql function can include letters, numbers, "_" and "-"
  "(?=[\\s]*\\()"; // Lookahead : A sql function should be followed by a "(" , spaces are allowed.

const matchDangerousStrings =
  SQL_DANGEROUS_IN_STRING.map(escapeStringRegexp).join("|");

const possibleSqlRegex = new RegExp(
  // Match one or more of : sql keywords, sql operators, sql functions
  `${matchSqlKeywords}|${matchSqlOperators}|${matchSqlFunctions}|${matchDangerousStrings}`,
  "im"
);

/**
 * This function is the first check in order to determine if a SQL injection is happening,
 * If the user input contains the necessary characters or words for a SQL injection, this
 * function returns true.
 * @param userInput The user input you want to check
 * @returns True when this is a possible SQL Injection
 */
export function userInputContainsSQLSyntax(userInput: string): boolean {
  return possibleSqlRegex.test(userInput);
}
