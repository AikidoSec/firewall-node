import { escapeStringRegexp } from "../../helpers/escapeStringRegexp";
import {
  COMMON_SQL_KEYWORDS,
  SQL_DANGEROUS_IN_STRING,
  SQL_KEYWORDS,
  SQL_OPERATORS,
} from "./config";
import { SQLDialect } from "./dialects/SQLDialect";

const cachedRegexes = new Map<string, RegExp>();

/**
 * This function is the first check in order to determine if a SQL injection is happening,
 * If the user input contains the necessary characters or words for a SQL injection, this
 * function returns true.
 */
export function userInputContainsSQLSyntax(
  userInput: string,
  dialect: SQLDialect
): boolean {
  // e.g. SELECT * FROM table WHERE column = 'value' LIMIT 1
  // If a query parameter is ?LIMIT=1 it would be blocked
  // If the body contains "LIMIT" or "SELECT" it would be blocked
  // These are common SQL keywords and appear in almost any SQL query
  if (COMMON_SQL_KEYWORDS.includes(userInput.toUpperCase())) {
    return false;
  }

  let regex = cachedRegexes.get(dialect.constructor.name);

  if (!regex) {
    regex = buildRegex(dialect);
    cachedRegexes.set(dialect.constructor.name, regex);
  }

  return regex.test(userInput);
}

function buildRegex(dialect: SQLDialect) {
  const matchSqlKeywords =
    "(?<![a-z_])(" + // Lookbehind : if the keywords are preceded by one or more letters, it should not match
    SQL_KEYWORDS.concat(dialect.getKeywords())
      .map(escapeStringRegexp)
      .join("|") + // Look for SQL Keywords
    ")(?![a-z_])"; // Lookahead : if the keywords are followed by one or more letters, it should not match

  const matchSqlOperators = `(${SQL_OPERATORS.map(escapeStringRegexp).join("|")})`;

  const matchSqlFunctions =
    "(?<=([\\s|.|" + // Lookbehind : A sql function should be preceded by spaces, dots,
    SQL_OPERATORS.map(escapeStringRegexp).join("|") + // Or sql operators
    "]|^)+)" +
    "([a-z0-9_-]+)" + // The name of a sql function can include letters, numbers, "_" and "-"
    "(?=[\\s]*\\()"; // Lookahead : A sql function should be followed by a "(" , spaces are allowed.

  const matchDangerousStrings = SQL_DANGEROUS_IN_STRING.concat(
    dialect.getDangerousStrings()
  )
    .map(escapeStringRegexp)
    .join("|");

  return new RegExp(
    // Match one or more of : sql keywords, sql operators, sql functions
    `${matchSqlKeywords}|${matchSqlOperators}|${matchSqlFunctions}|${matchDangerousStrings}`,
    "im"
  );
}
