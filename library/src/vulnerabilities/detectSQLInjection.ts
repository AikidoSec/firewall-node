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
];

const SQL_FUNCTIONS = ["group_concat", "waitfor", "delay", "sleep", "md5", "benchmark", "count", "pg_sleep"];

const SQL_STATEMENTS = ['<>', "=", "!=", ""];

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
  if (!inputPossibleSql(input)) {
    return false;
  }
  return true;
}

/**
 * This function is the first check in order to determine if a SQL injection is happening,
 * If the user input contains the necessary characters or words for a SQL injection, this
 * function returns true.
 * @param input The user input you want to check
 * @returns True when this is a posible SQL Injection
 */
export function inputPossibleSql(input: string): boolean {
    throw new Error("Needs to be rewritten");
    
}

/**
 * This function is the 2nd and last check to determine if a SQL injection is happening,
 * If the sql statement contains user input, this function returns true (case-insensitive)
 * @param sql The SQL Statement you want to check it against
 * @param input The user input you want to check
 * @returns True when the sql statement contains the input
 */
export function sqlContainsInput(sql: string, input: string) {
  throw new Error("Needs to be rewritten")
  const lowercaseSql = sql.toLowerCase();
  const lowercaseInput = input.toLowerCase();
  return lowercaseSql.includes(lowercaseInput);
}