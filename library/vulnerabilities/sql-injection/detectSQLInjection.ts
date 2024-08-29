import { escapeStringRegexp } from "../../helpers/escapeStringRegexp";
import { SQLDialect } from "./dialects/SQLDialect";
import { queryContainsUserInput } from "./queryContainsUserInput";
import { getType, tokenize } from "./tokenize";

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

  if (userInput.length > query.length) {
    // We ignore cases where the user input is longer than the query.
    // Because the user input can't be part of the query.
    return false;
  }

  if (!queryContainsUserInput(query, userInput)) {
    // If the user input is not part of the query, return false (No need to check)
    return false;
  }

  let tokens;
  try {
    tokens = tokenize(dialect, query);
  } catch (error) {
    console.log("error", query, error);
    return false;
  }

  const replaced = query.replace(
    new RegExp(escapeStringRegexp(userInput), "gi"),
    "str"
  );

  let replacedTokens;
  try {
    replacedTokens = tokenize(dialect, replaced);
  } catch (error) {
    console.log("error", replaced, error);
    return false;
  }

  if (query === "SELECT $$") {
    console.log("original", query, tokens);
    console.log("replaced", replaced, replacedTokens);
  }

  if (tokens.length !== replacedTokens.length) {
    // If the token count is different, the user input is part of a string.
    return true;
  }

  for (let i = 0; i < tokens.length; i++) {
    if (getType(tokens[i]) !== getType(replacedTokens[i])) {
      // If the token type is different, the user input is part of a string.
      return true;
    }
  }

  return false;
}
