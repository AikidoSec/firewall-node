import { tokenize as wasmTokenize } from "../../sql-tokenizer/sql_tokenizer";
import { SQLDialect } from "./dialects/SQLDialect";
import { SQLDialectMySQL } from "./dialects/SQLDialectMySQL";
import { SQLDialectPostgres } from "./dialects/SQLDialectPostgres";
import { SQLDialectSQLite } from "./dialects/SQLDialectSQLite";

type Whitespace =
  | "Space"
  | "Newline"
  | "Tab"
  | { SingleLineComment: { comment: string; prefix: string } }
  | { MultiLineComment: string };

export type Token =
  | {
      Word: {
        value: string;
        quote_style?: string | undefined;
        keyword: string;
      };
    }
  | { Whitespace: Whitespace }
  | { SingleQuotedString: string }
  | { DoubleQuotedString: string }
  | { TripleSingleQuotedString: string }
  | { TripleDoubleQuotedString: string }
  | { DollarQuotedString: string }
  | { SingleQuotedByteStringLiteral: string }
  | { DoubleQuotedByteStringLiteral: string }
  | { TripleSingleQuotedByteStringLiteral: string }
  | { TripleDoubleQuotedByteStringLiteral: string }
  | { SingleQuotedRawStringLiteral: string }
  | { DoubleQuotedRawStringLiteral: string }
  | { TripleSingleQuotedRawStringLiteral: string }
  | { TripleDoubleQuotedRawStringLiteral: string }
  | { NationalStringLiteral: string }
  | { EscapedStringLiteral: string }
  | { UnicodeStringLiteral: string }
  | { HexStringLiteral: string }
  | { Placeholder: string }
  | { CustomBinaryOperator: string }
  | string; // for tokens like Arrow, ArrowAt, RArrow, etc.

function dialectToString(dialect: SQLDialect) {
  if (dialect instanceof SQLDialectMySQL) {
    return "mysql";
  }

  if (dialect instanceof SQLDialectSQLite) {
    return "sqlite";
  }

  if (dialect instanceof SQLDialectPostgres) {
    return "postgres";
  }

  throw new Error("Unsupported dialect: " + dialect.constructor.name);
}

export function tokenize(dialect: SQLDialect, sql: string): Token[] {
  return wasmTokenize(dialectToString(dialect), sql);
}
