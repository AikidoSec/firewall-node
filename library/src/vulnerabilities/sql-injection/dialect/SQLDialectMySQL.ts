import { SQLDialect, Range } from "./SQLDialect";

export class SQLDialectMySQL implements SQLDialect {
  getEscapedRanges(sql: string): Range[] {
    const ranges: Range[] = [];
    let literal: { start: number; quote: string } | undefined = undefined;
    const escapeQuotes = ["'", '"'];

    for (let i = 0; i < sql.length; i++) {
      const char = sql[i];

      if (char === "\\") {
        i++;
        continue;
      }

      for (const quote of escapeQuotes) {
        if (char === quote) {
          if (literal && literal.quote === quote) {
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

    if (literal) {
      return [];
    }

    return ranges;
  }
}
