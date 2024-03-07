/* eslint-disable max-lines-per-function */
import { Range, SQLDialect } from "./SQLDialect";

export class SQLDialectPostgres implements SQLDialect {
  // https://www.postgresql.org/docs/current/sql-syntax-lexical.html
  getEscapedRanges(sql: string): Range[] {
    const ranges: Range[] = [];
    let literal:
      | { start: number; tag: false }
      | { start: number; tag: true; name?: string }
      | undefined = undefined;
    const escapeQuotes = ["'"];
    let inSingleLineComment = false;
    let inMultiLineComment = false;

    for (let i = 0; i < sql.length; i++) {
      const char = sql[i];
      const nextChar = sql[i + 1];

      // Check if we're currently in a single line comment
      if (!literal && inSingleLineComment) {
        if (char === "\n") {
          inSingleLineComment = false;
        }
        continue;
      }

      // Check if we're currently in a multi line comment
      if (!literal && inMultiLineComment) {
        if (char === "*" && nextChar === "/") {
          inMultiLineComment = false;
          i++; // Move past the '/'
        }
        continue;
      }

      // Check for the start of single line comments
      if (char === "#" || (char === "-" && nextChar === "-")) {
        inSingleLineComment = true;
        continue;
      }

      // Check for the start of multi line comments
      if (char === "/" && nextChar === "*") {
        inMultiLineComment = true;
        i++; // Skip the '*' to avoid confusion with closing tags
        continue;
      }

      // Process literals and escaped characters
      if (char === "\\" && literal) {
        i++; // Skip escaped character
        continue;
      }

      if (escapeQuotes.includes(char) && (literal ? !literal.tag : true)) {
        if (literal) {
          // Check for escape sequence of the quote itself
          if (sql[i + 1] === char) {
            i++; // Skip the next quote
            continue;
          }

          const contents = sql.slice(literal.start + 1, i);

          if (contents.length > 0) {
            ranges.push([literal.start + 1, i - 1, contents]);
          }

          literal = undefined; // Exit literal
          continue;
        }

        if (!literal) {
          literal = { start: i, tag: false }; // Start a new literal
        }
      }

      if (char === "$" && (literal ? literal.tag : true)) {
        if (
          literal &&
          literal.tag &&
          literal.name &&
          sql.slice(i + 1).startsWith(`${literal.name}$`)
        ) {
          const contents = sql.slice(
            literal.start + literal.name.length + 2,
            i
          );
          if (contents.length > 0) {
            ranges.push([
              literal.start + literal.name.length + 2,
              i - 1,
              contents,
            ]);
          }
          i += literal.name.length + 1; // Skip the tag name and the next '$'
          literal = undefined; // Exit literal
          continue;
        }

        if (literal && nextChar === "$") {
          const contents = sql.slice(literal.start + 2, i);
          if (contents.length > 0) {
            ranges.push([literal.start + 2, i - 1, contents]);
          }
          literal = undefined; // Exit literal
          i++; // Skip the next '$'
          continue;
        }

        if (!literal && nextChar === "$") {
          literal = { start: i, tag: true };
          i++; // Skip the next '$'
          continue;
        }

        if (!literal) {
          const name = /^([A-Za-z0-9_]+)\$/;
          const match = sql.slice(i + 1).match(name);
          if (match) {
            literal = { start: i, tag: true, name: match[1] };
            i += match[1].length; // Skip the tag name
          }
        }
      }
    }

    // Check for unclosed literal as an error in SQL syntax
    if (literal) {
      return [];
    }

    return ranges;
  }

  // psql -h 127.0.0.1 -p 27016 -U root -d main_db -c 'SELECT oprname FROM pg_operator GROUP BY oprname' | pbcopy
  getOperators(): string[] {
    return [
      "->",
      "=",
      "*=",
      "-",
      "^@",
      "!~~*",
      "~>~",
      "<>",
      "<<|",
      "*<>",
      "|",
      "|>>",
      "?",
      "<",
      "&&",
      "?&",
      "@@",
      "<<=",
      "&",
      "*<=",
      "!~~",
      "~=",
      "#>",
      "||",
      "|&>",
      "->>",
      "?||",
      "<^",
      "-|-",
      "@>",
      "*",
      "<<",
      "~<=~",
      ">>",
      "~",
      "##",
      "*>",
      "?#",
      "~*",
      "&>",
      "^",
      "?-|",
      "%",
      "!~",
      "#-",
      "#",
      "?|",
      "||/",
      "?-",
      "*>=",
      ">^",
      "@@@",
      "~<~",
      "!~*",
      "|/",
      "~>=~",
      ">",
      ">>=",
      "&<",
      "!!",
      ">=",
      "&<|",
      "<@",
      "<->",
      "/",
      "<=",
      "+",
      "*<",
      "@-@",
      "@",
      "~~*",
      "#>>",
      "~~",
      "@?",
      "::",
    ];
  }

  // https://www.postgresql.org/docs/current/sql-keywords-appendix.html
  getKeywords(): string[] {
    return [
      "ABORT",
      "ABSENT",
      "ABSOLUTE",
      "ACCESS",
      "ACTION",
      "ADD",
      "ADMIN",
      "AFTER",
      "AGGREGATE",
      "ALL",
      "ALSO",
      "ALTER",
      "ALWAYS",
      "ANALYSE",
      "ANALYZE",
      "AND",
      "ANY",
      "ARRAY",
      "AS",
      "ASC",
      "ASENSITIVE",
      "ASSERTION",
      "ASSIGNMENT",
      "ASYMMETRIC",
      "AT",
      "ATOMIC",
      "ATTACH",
      "ATTRIBUTE",
      "AUTHORIZATION",
      "BACKWARD",
      "BEFORE",
      "BEGIN",
      "BETWEEN",
      "BIGINT",
      "BINARY",
      "BIT",
      "BOOLEAN",
      "BOTH",
      "BREADTH",
      "BY",
      "CACHE",
      "CALL",
      "CALLED",
      "CASCADE",
      "CASCADED",
      "CASE",
      "CAST",
      "CATALOG",
      "CHAIN",
      "CHAR",
      "CHARACTER",
      "CHARACTERISTICS",
      "CHECK",
      "CHECKPOINT",
      "CLASS",
      "CLOSE",
      "CLUSTER",
      "COALESCE",
      "COLLATE",
      "COLLATION",
      "COLUMN",
      "COLUMNS",
      "COMMENT",
      "COMMENTS",
      "COMMIT",
      "COMMITTED",
      "COMPRESSION",
      "CONCURRENTLY",
      "CONFIGURATION",
      "CONFLICT",
      "CONNECTION",
      "CONSTRAINT",
      "CONSTRAINTS",
      "CONTENT",
      "CONTINUE",
      "CONVERSION",
      "COPY",
      "COST",
      "CREATE",
      "CROSS",
      "CSV",
      "CUBE",
      "CURRENT",
      "CURRENT_CATALOG",
      "CURRENT_DATE",
      "CURRENT_ROLE",
      "CURRENT_SCHEMA",
      "CURRENT_TIME",
      "CURRENT_TIMESTAMP",
      "CURRENT_USER",
      "CURSOR",
      "CYCLE",
      "DATA",
      "DATABASE",
      "DAY",
      "DEALLOCATE",
      "DEC",
      "DECIMAL",
      "DECLARE",
      "DEFAULT",
      "DEFAULTS",
      "DEFERRABLE",
      "DEFERRED",
      "DEFINER",
      "DELETE",
      "DELIMITER",
      "DELIMITERS",
      "DEPENDS",
      "DEPTH",
      "DESC",
      "DETACH",
      "DICTIONARY",
      "DISABLE",
      "DISCARD",
      "DISTINCT",
      "DO",
      "DOCUMENT",
      "DOMAIN",
      "DOUBLE",
      "DROP",
      "EACH",
      "ELSE",
      "ENABLE",
      "ENCODING",
      "ENCRYPTED",
      "END",
      "ENUM",
      "ESCAPE",
      "EVENT",
      "EXCEPT",
      "EXCLUDE",
      "EXCLUDING",
      "EXCLUSIVE",
      "EXECUTE",
      "EXISTS",
      "EXPLAIN",
      "EXPRESSION",
      "EXTENSION",
      "EXTERNAL",
      "EXTRACT",
      "FALSE",
      "FAMILY",
      "FETCH",
      "FILTER",
      "FINALIZE",
      "FIRST",
      "FLOAT",
      "FOLLOWING",
      "FOR",
      "FORCE",
      "FOREIGN",
      "FORMAT",
      "FORWARD",
      "FREEZE",
      "FROM",
      "FULL",
      "FUNCTION",
      "FUNCTIONS",
      "GENERATED",
      "GLOBAL",
      "GRANT",
      "GRANTED",
      "GREATEST",
      "GROUP",
      "GROUPING",
      "GROUPS",
      "HANDLER",
      "HAVING",
      "HEADER",
      "HOLD",
      "HOUR",
      "IDENTITY",
      "IF",
      "ILIKE",
      "IMMEDIATE",
      "IMMUTABLE",
      "IMPLICIT",
      "IMPORT",
      "IN",
      "INCLUDE",
      "INCLUDING",
      "INCREMENT",
      "INDENT",
      "INDEX",
      "INDEXES",
      "INHERIT",
      "INHERITS",
      "INITIALLY",
      "INLINE",
      "INNER",
      "INOUT",
      "INPUT",
      "INSENSITIVE",
      "INSERT",
      "INSTEAD",
      "INT",
      "INTEGER",
      "INTERSECT",
      "INTERVAL",
      "INTO",
      "INVOKER",
      "IS",
      "ISNULL",
      "ISOLATION",
      "JOIN",
      "JSON",
      "JSON_ARRAY",
      "JSON_ARRAYAGG",
      "JSON_OBJECT",
      "JSON_OBJECTAGG",
      "KEY",
      "KEYS",
      "LABEL",
      "LANGUAGE",
      "LARGE",
      "LAST",
      "LATERAL",
      "LEADING",
      "LEAKPROOF",
      "LEAST",
      "LEFT",
      "LEVEL",
      "LIKE",
      "LIMIT",
      "LISTEN",
      "LOAD",
      "LOCAL",
      "LOCALTIME",
      "LOCALTIMESTAMP",
      "LOCATION",
      "LOCK",
      "LOCKED",
      "LOGGED",
      "MAPPING",
      "MATCH",
      "MATCHED",
      "MATERIALIZED",
      "MAXVALUE",
      "MERGE",
      "METHOD",
      "MINUTE",
      "MINVALUE",
      "MODE",
      "MONTH",
      "MOVE",
      "NAME",
      "NAMES",
      "NATIONAL",
      "NATURAL",
      "NCHAR",
      "NEW",
      "NEXT",
      "NFC",
      "NFD",
      "NFKC",
      "NFKD",
      "NO",
      "NONE",
      "NORMALIZE",
      "NORMALIZED",
      "NOT",
      "NOTHING",
      "NOTIFY",
      "NOTNULL",
      "NOWAIT",
      "NULL",
      "NULLIF",
      "NULLS",
      "NUMERIC",
      "OBJECT",
      "OF",
      "OFF",
      "OFFSET",
      "OIDS",
      "OLD",
      "ON",
      "ONLY",
      "OPERATOR",
      "OPTION",
      "OPTIONS",
      "OR",
      "ORDER",
      "ORDINALITY",
      "OTHERS",
      "OUT",
      "OUTER",
      "OVER",
      "OVERLAPS",
      "OVERLAY",
      "OVERRIDING",
      "OWNED",
      "OWNER",
      "PARALLEL",
      "PARAMETER",
      "PARSER",
      "PARTIAL",
      "PARTITION",
      "PASSING",
      "PASSWORD",
      "PLACING",
      "PLANS",
      "POLICY",
      "POSITION",
      "PRECEDING",
      "PRECISION",
      "PREPARE",
      "PREPARED",
      "PRESERVE",
      "PRIMARY",
      "PRIOR",
      "PRIVILEGES",
      "PROCEDURAL",
      "PROCEDURE",
      "PROCEDURES",
      "PROGRAM",
      "PUBLICATION",
      "QUOTE",
      "RANGE",
      "READ",
      "REAL",
      "REASSIGN",
      "RECHECK",
      "RECURSIVE",
      "REF",
      "REFERENCES",
      "REFERENCING",
      "REFRESH",
      "REINDEX",
      "RELATIVE",
      "RELEASE",
      "RENAME",
      "REPEATABLE",
      "REPLACE",
      "REPLICA",
      "RESET",
      "RESTART",
      "RESTRICT",
      "RETURN",
      "RETURNING",
      "RETURNS",
      "REVOKE",
      "RIGHT",
      "ROLE",
      "ROLLBACK",
      "ROLLUP",
      "ROUTINE",
      "ROUTINES",
      "ROW",
      "ROWS",
      "RULE",
      "SAVEPOINT",
      "SCALAR",
      "SCHEMA",
      "SCHEMAS",
      "SCROLL",
      "SEARCH",
      "SECOND",
      "SECURITY",
      "SELECT",
      "SEQUENCE",
      "SEQUENCES",
      "SERIALIZABLE",
      "SERVER",
      "SESSION",
      "SESSION_USER",
      "SET",
      "SETOF",
      "SETS",
      "SHARE",
      "SHOW",
      "SIMILAR",
      "SIMPLE",
      "SKIP",
      "SMALLINT",
      "SNAPSHOT",
      "SOME",
      "SQL",
      "STABLE",
      "STANDALONE",
      "START",
      "STATEMENT",
      "STATISTICS",
      "STDIN",
      "STDOUT",
      "STORAGE",
      "STORED",
      "STRICT",
      "STRIP",
      "SUBSCRIPTION",
      "SUBSTRING",
      "SUPPORT",
      "SYMMETRIC",
      "SYSID",
      "SYSTEM",
      "SYSTEM_USER",
      "TABLE",
      "TABLES",
      "TABLESAMPLE",
      "TABLESPACE",
      "TEMP",
      "TEMPLATE",
      "TEMPORARY",
      "TEXT",
      "THEN",
      "TIES",
      "TIME",
      "TIMESTAMP",
      "TO",
      "TRAILING",
      "TRANSACTION",
      "TRANSFORM",
      "TREAT",
      "TRIGGER",
      "TRIM",
      "TRUE",
      "TRUNCATE",
      "TRUSTED",
      "TYPE",
      "TYPES",
      "UESCAPE",
      "UNBOUNDED",
      "UNCOMMITTED",
      "UNENCRYPTED",
      "UNION",
      "UNIQUE",
      "UNKNOWN",
      "UNLISTEN",
      "UNLOGGED",
      "UNTIL",
      "UPDATE",
      "USER",
      "USING",
      "VACUUM",
      "VALID",
      "VALIDATE",
      "VALIDATOR",
      "VALUE",
      "VALUES",
      "VARCHAR",
      "VARIADIC",
      "VARYING",
      "VERBOSE",
      "VERSION",
      "VIEW",
      "VIEWS",
      "VOLATILE",
      "WHEN",
      "WHERE",
      "WHITESPACE",
      "WINDOW",
      "WITH",
      "WITHIN",
      "WITHOUT",
      "WORK",
      "WRAPPER",
      "WRITE",
      "XML",
      "XMLATTRIBUTES",
      "XMLCONCAT",
      "XMLELEMENT",
      "XMLEXISTS",
      "XMLFOREST",
      "XMLNAMESPACES",
      "XMLPARSE",
      "XMLPI",
      "XMLROOT",
      "XMLSERIALIZE",
      "XMLTABLE",
      "YEAR",
      "YES",
      "ZONE",
    ];
  }
}
