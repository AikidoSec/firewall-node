import { SQLDialect, Range } from "./SQLDialect";

// https://github.com/mysql/mysql-server/blob/trunk/sql/lex.h
export class SQLDialectMySQL implements SQLDialect {
  getEscapedRanges(sql: string): Range[] {
    const ranges: Range[] = [];
    let literal: { start: number; quote: string } | undefined = undefined;
    const escapeQuotes = ["'", '"'];
    let inSingleLineComment = false;
    let inMultiLineComment = false;

    for (let i = 0; i < sql.length; i++) {
      const char = sql[i];
      const nextChar = sql[i + 1];

      // Skip processing for escaped characters, ensuring we're not in a comment
      if (
        char === "\\" &&
        !inSingleLineComment &&
        !inMultiLineComment &&
        literal
      ) {
        i++;
        continue;
      }

      // Start or end of literal processing
      if (
        escapeQuotes.includes(char) &&
        !inSingleLineComment &&
        !inMultiLineComment
      ) {
        if (literal && literal.quote === char) {
          // Check for escape sequence of the quote itself
          if (sql[i + 1] === char) {
            i++; // Skip the next quote
            continue;
          }

          ranges.push([literal.start, i, sql.slice(literal.start + 1, i)]);
          literal = undefined; // Exit literal
          continue;
        }

        if (!literal) {
          literal = { start: i, quote: char }; // Start a new literal
          continue;
        }
      }

      // Only check for comments if not inside a literal
      if (!literal) {
        // Single-line comment start
        if (
          (char === "#" || (char === "-" && nextChar === "-")) &&
          !inMultiLineComment
        ) {
          inSingleLineComment = true;
          continue;
        }

        // Multi-line comment start
        if (char === "/" && nextChar === "*" && !inSingleLineComment) {
          inMultiLineComment = true;
          i++; // Skip the '*' to avoid confusion with closing tags
          continue;
        }

        // End of single-line comment
        if (inSingleLineComment && char === "\n") {
          inSingleLineComment = false;
          continue;
        }

        // End of multi-line comment
        if (inMultiLineComment && char === "*" && nextChar === "/") {
          inMultiLineComment = false;
          i++; // Move past the '/'
          continue;
        }
      }
    }

    // Check for unclosed literal as an error in SQL syntax
    if (literal) {
      // Unclosed literal, return an empty range or handle as an error
      return [];
    }

    return ranges;
  }
}
