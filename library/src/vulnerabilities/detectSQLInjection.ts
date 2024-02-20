// Declare constants
const SQL_KEYWORDS = [
  "INSERT",
  "SELECT",
  "CREATE",
  "DROP",
  "DATABASE",
  "UPDATE",
  "DELETE",
  "ALTER",
  "GRANT",
  "SAVEPOINT",
  "COMMIT",
  "ROLLBACK",
  "TRUNCATE",
  "OR",
  "AND",
  "UNION",
  "AS",
  "WHERE",
  "DISTINCT",
  "FROM",
  "INTO",
  "TOP",
  "BETWEEN",
  "LIKE",
  "IN",
  "NULL",
  "NOT",
  "TABLE",
  "INDEX",
  "VIEW",
  "COUNT",
  "SUM",
  "AVG",
  "MIN",
  "MAX",
  "GROUP",
  "BY",
  "HAVING",
  "DESC",
  "ASC",
  "OFFSET",
  "FETCH",
  "LEFT",
  "RIGHT",
  "INNER",
  "OUTER",
  "JOIN",
  "EXISTS",
  "REVOKE",
  "ALL",
  "LIMIT",
  "ORDER",
  "ADD",
  "CONSTRAINT",
  "COLUMN",
  "ANY",
  "BACKUP",
  "CASE",
  "CHECK",
  "REPLACE",
  "DEFAULT",
  "EXEC",
  "FOREIGN",
  "KEY",
  "FULL",
  "PROCEDURE",
  "ROWNUM",
  "SET",
  "UNIQUE",
  "VALUES",
  "COLLATE",
];
const SQL_DANGEROUS_IN_STRING = ["\\\\", `'`, `"`, "`", "\\/\\*", "--"];
const SQL_FUNCTIONS = [
  "group_concat",
  "waitfor",
  "delay",
  "sleep",
  "md5",
  "benchmark",
  "count",
  "pg_sleep",
];
const SQL_STATEMENTS = ["<>", "=", "!=", ";"];
const SQL_STRING_CHARS = [`"`, `'`];

// Declare Regexes
const dangerousInStringRegex = new RegExp(
  SQL_DANGEROUS_IN_STRING.join("|"),
  "mgi"
);
const possibleSqlRegex = new RegExp(
  [...SQL_STATEMENTS, ...SQL_FUNCTIONS, ...SQL_KEYWORDS].join("|"),
  "mgi"
);

/**
 * This function executes 2 checks to see if something is or is not an SQL Injection :
 * Step 2 : sqlContainsInput
 * 2. Executes sqlContainsInput() - This checks wether the input is in the sql
 * @param sql The SQL Statement that's going to be executed
 * @param input The user input that might be dangerous
 * @returns True if SQL Injection is detected
 */
export function detectSQLInjection(sql: string, input: string) {
  if (!sqlContainsInput(sql, input)) {
    return false;
  }
  if (dangerousCharsInInput(input)) {
    return true;
  }
  if (!inputAlwaysEncapsulated(sql, input) && inputPossibleSql(input)) {
    return true;
  }
  return false;
}

/**
 * This function is the first check in order to determine if a SQL injection is happening,
 * If the user input contains the necessary characters or words for a SQL injection, this
 * function returns true.
 * @param input The user input you want to check
 * @returns True when this is a posible SQL Injection
 */
export function inputPossibleSql(input: string): boolean {
    return possibleSqlRegex.test(input)
}

/**
 * This function is the first step to determine if an SQL Injection is happening,
 * If the sql statement contains user input, this function returns true (case-insensitive)
 * @param sql The SQL Statement you want to check it against
 * @param input The user input you want to check
 * @returns True when the sql statement contains the input
 */
export function sqlContainsInput(sql: string, input: string) {
  const lowercaseSql = sql.toLowerCase();
  const lowercaseInput = input.toLowerCase();
  return lowercaseSql.includes(lowercaseInput);
}

/**
 * This function is the second step to determine if an SQL Injection is happening,
 * If the user input contains characters that should never end up in a query, not
 * even in a string, this function returns true.
 * @param input The user input you want to check
 * @returns True if characters are present
 */
export function dangerousCharsInInput(input: string): boolean {
  return dangerousInStringRegex.test(input);
}

/**
 * This function is the third step to determine if an SQL Injection is happening,
 * This checks if **all** occurences of our input are encapsulated as strings.
 * @param sql The SQL Statement
 * @param input The user input you want to check is encapsulated
 * @returns True if the input is always encapsulated inside a string
 */
export function inputAlwaysEncapsulated(sql: string, input: string) {
  const sqlWithoutUserInput = sql.split(input);
  for (let i = 0; i + 1 < sqlWithoutUserInput.length; i++) {
    // Get the last character of this segment
    const lastChar = sqlWithoutUserInput[i].slice(-1);
    // Get the first character of the next segment
    const firstCharNext = sqlWithoutUserInput[i + 1].slice(0, 1);

    if (!SQL_STRING_CHARS.includes(lastChar)) {
      return false; // If the character is not one of these, it's not a string.
    }
    if (lastChar != firstCharNext) {
      return false; // String is not encapsulated by the same type of quotes.
    }
  }
  return true;
}
