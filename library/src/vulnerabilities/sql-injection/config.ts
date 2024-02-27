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
  "IS",
];

// We make use of double backslashes to create a single backslash in the RegEx
const SQL_OPERATORS = [
  "=",
  "!",
  ";",
  "\\+", // This checks for "+"
  "\\-", // This checks for "-"
  "\\*", // This checks for "*"
  "\\/", // This checks for a slash
  "%",
  "&",
  "\\|", // This checks for "|"
  "\\^", // This checks for "^"
  ">",
  "<",
];

// We make use of double backslashes to create a single backslash in the RegEx
const SQL_DANGEROUS_IN_STRING = [
  "\\\\", // Check for backslashes : "\"
  "'", // Check for single quotes
  '"', // Check for double quotes
  "`", // Check for `
  "\\/\\*", // Check for the start of a comment : "/*"
  "--", // Check for the the start of a comment : "--"
];
const SQL_STRING_CHARS = ['"', "'"];

export {
  SQL_KEYWORDS,
  SQL_OPERATORS,
  SQL_DANGEROUS_IN_STRING,
  SQL_STRING_CHARS,
};
