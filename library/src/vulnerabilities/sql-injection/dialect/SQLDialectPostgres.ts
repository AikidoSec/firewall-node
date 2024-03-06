import { Range, SQLDialect } from "./SQLDialect";

export class SQLDialectPostgres implements SQLDialect {
  // eslint-disable-next-line max-lines-per-function
  getEscapedRanges(sql: string): Range[] {
    const ranges: Range[] = [];
    let literal:
      | { start: number; quote: string; isDollarQuoted: boolean; tag?: string }
      | undefined = undefined;
    let inSingleLineComment = false;
    let inMultiLineComment = false;

    for (let i = 0; i < sql.length; i++) {
      const char = sql[i];
      const nextChar = sql[i + 1];
      const prevChar = i > 0 ? sql[i - 1] : "";

      // Dollar quoting start or end
      if (
        !literal &&
        char === "$" &&
        !inSingleLineComment &&
        !inMultiLineComment
      ) {
        const endOfTagIndex = sql.indexOf("$", i + 1);
        const tag = sql.slice(i, endOfTagIndex + 1);
        if (!literal) {
          literal = { start: i, quote: tag, isDollarQuoted: true };
          i = endOfTagIndex; // Move past the end of the tag
          continue;
        }
      }

      if (literal?.isDollarQuoted) {
        if (sql.startsWith(literal.quote, i)) {
          // End of dollar-quoted string
          ranges.push([
            literal.start,
            i + literal.quote.length - 1,
            sql.slice(literal.start + literal.quote.length, i),
          ]);
          i += literal.quote.length - 1; // Skip past the end tag
          literal = undefined;
          continue;
        }
      }

      // Escape sequences for non-dollar quoted strings
      if (
        char === "\\" &&
        !literal?.isDollarQuoted &&
        !inSingleLineComment &&
        !inMultiLineComment &&
        literal &&
        (prevChar.toUpperCase() !== "E" || sql[i + 1] === "'")
      ) {
        i++; // Skip the next character as it's escaped
        continue;
      }

      // Start or end of standard or escape string constant
      if (
        (char === "'" && !inSingleLineComment && !inMultiLineComment) ||
        (literal && !literal.isDollarQuoted && literal.quote === char)
      ) {
        if (literal && literal.quote === char && !literal.isDollarQuoted) {
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
          literal = { start: i, quote: char, isDollarQuoted: false }; // Start a new literal
          continue;
        }
      }

      // Only check for comments if not inside a literal
      if (!literal) {
        // Single-line comment start
        if (char === "-" && nextChar === "-" && !inMultiLineComment) {
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
