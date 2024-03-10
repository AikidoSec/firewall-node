import { escapeStringRegexp } from "../../helpers/escapeStringRegexp";
import { SQLDialect } from "./dialect/SQLDialect";

function compileSqlRegex(dialect: SQLDialect): RegExp {
  const operators = dialect.getOperators();
  const keywords = dialect.getKeywords();
  const matchSqlKeywords =
    "(?<![a-z])(" + // Lookbehind : if the keywords are preceded by one or more letters, it should not match
    keywords.map(escapeStringRegexp).join("|") + // Look for SQL Keywords
    ")(?![a-z])"; // Lookahead : if the keywords are followed by one or more letters, it should not match

  const matchSqlOperators = `(${operators.map(escapeStringRegexp).join("|")})`;
  const matchSqlFunctions =
    "(?<=([\\s|.|" + // Lookbehind : A sql function should be preceded by spaces, dots,
    operators.map(escapeStringRegexp).join("|") + // Or sql operators
    "]|^)+)" +
    "([a-z0-9_-]+)" + // The name of a sql function can include letters, numbers, "_" and "-"
    "(?=[\\s]*\\()"; // Lookahead : A sql function should be followed by a "(" , spaces are allowed.

  const matchTerminator = "(;)";

  return new RegExp(
    `${matchSqlKeywords}|${matchSqlOperators}|${matchSqlFunctions}|${matchTerminator}`,
    "im"
  );
}

const cache = new Map<string, RegExp>();

/**
 * This function is the first check in order to determine if a SQL injection is happening,
 * If the user input contains the necessary characters or words for a SQL injection, this
 * function returns true.
 */
export function userInputContainsSQLSyntax(
  userInput: string,
  dialect: SQLDialect
): boolean {
  let possibleSqlRegex = cache.get(dialect.constructor.name);

  if (!possibleSqlRegex) {
    possibleSqlRegex = compileSqlRegex(dialect);
    cache.set(dialect.constructor.name, possibleSqlRegex);
  }

  return possibleSqlRegex.test(userInput);
}
