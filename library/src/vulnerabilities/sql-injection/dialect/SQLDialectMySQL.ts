import { SQLDialect, Range } from "./SQLDialect";

export class SQLDialectMySQL implements SQLDialect {
  getEscapedRanges(sql: string): Range[] {
    const ranges: Range[] = [];
    let literal: { start: number; quote: string } | undefined = undefined;

    for (let i = 0; i < sql.length; i++) {
      const char = sql[i];

      if (char === "'") {
        if (literal && literal.quote === "'") {
          if (sql[i + 1] === "'") {
            i++;
            continue;
          }

          ranges.push([literal.start, i, sql.slice(literal.start + 1, i)]);
          literal = undefined;
          continue;
        }

        literal = { start: i, quote: char };
      }

      if (char === '"') {
        if (literal && literal.quote === '"') {
          if (sql[i + 1] === '"') {
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

    if (literal) {
      return [];
    }

    return ranges;
  }
}
