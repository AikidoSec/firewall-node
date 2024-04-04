export const SQL_KEYWORDS = [
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
  "SESSION",
  "GLOBAL",
  "UNIQUE",
  "VALUES",
  "COLLATE",
  "IS",
];

export const SQL_OPERATORS = [
  "=",
  "!",
  ";",
  "+",
  "-",
  "*",
  "/",
  "%",
  "&",
  "|",
  "^",
  ">",
  "<",
  "#",
  "::",
];

export const SQL_STRING_CHARS = ['"', "'", "`"];

export const SQL_DANGEROUS_IN_STRING = [
  '"', // Double quote
  "'", // Single quote
  "`", // Backtick
  "\\", // Escape character
  "/*", // Start of comment
  "*/", // End of comment
  "--", // Start of comment
  "#", // Start of comment
];

export const SQL_ESCAPE_SEQUENCES = ["\\n", "\\r", "\\t"];