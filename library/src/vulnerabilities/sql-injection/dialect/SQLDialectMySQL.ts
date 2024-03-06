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

      // Handle escaping characters
      if (char === "\\" && !inSingleLineComment && !inMultiLineComment) {
        i++;
        continue;
      }

      // Check for single-line comment start
      if (
        (char === "#" || (char === "-" && nextChar === "-")) &&
        !inMultiLineComment
      ) {
        inSingleLineComment = true;
        continue;
      }

      // Check for multi-line comment start
      if (char === "/" && nextChar === "*" && !inSingleLineComment) {
        inMultiLineComment = true;
        i++; // Skip the '*' to avoid confusion with closing tags
        continue;
      }

      // Handle end of single-line comment
      if (inSingleLineComment && char === "\n") {
        inSingleLineComment = false;
        continue;
      }

      // Handle end of multi-line comment
      if (inMultiLineComment && char === "*" && nextChar === "/") {
        inMultiLineComment = false;
        i++; // Move past the '/'
        continue;
      }

      // Skip literal processing if we're inside a comment
      if (inSingleLineComment || inMultiLineComment) {
        continue;
      }

      // Literal processing
      for (const quote of escapeQuotes) {
        if (char === quote) {
          if (literal && literal.quote === quote) {
            // Double quote escape check
            if (sql[i + 1] === quote) {
              i++;
              continue;
            }

            ranges.push([literal.start, i, sql.slice(literal.start + 1, i)]);
            literal = undefined;
            continue;
          }

          literal = { start: i, quote: char };
        }
      }
    }

    // If we end up with an unclosed literal, it's an error in the SQL syntax
    if (literal) {
      return [];
    }

    return ranges;
  }
}
