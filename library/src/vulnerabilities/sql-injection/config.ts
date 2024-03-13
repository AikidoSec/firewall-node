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
