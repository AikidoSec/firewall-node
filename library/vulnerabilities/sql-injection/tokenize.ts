import { tokenize as wasmTokenize } from "../../sql-tokenizer/sql_tokenizer";

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

export function tokenize(
  dialect: "mysql" | "postgres" | "sqlite",
  sql: string
): Token[] {
  return wasmTokenize(dialect, sql);
}
