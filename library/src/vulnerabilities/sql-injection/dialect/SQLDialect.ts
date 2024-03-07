export type Range = [number, number, string];

export interface SQLDialect {
  getEscapedRanges(sql: string): Range[];
  getKeywords(): string[];
  getOperators(): string[];
}
