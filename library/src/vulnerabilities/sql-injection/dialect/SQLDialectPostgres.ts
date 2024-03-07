import { Range, SQLDialect } from "./SQLDialect";

export class SQLDialectPostgres implements SQLDialect {
  // eslint-disable-next-line max-lines-per-function
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

      if (escapeQuotes.includes(char)) {
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

      if (char === "$") {
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
      }
    }

    // Check for unclosed literal as an error in SQL syntax
    if (literal) {
      return [];
    }

    return ranges;
  }
}
