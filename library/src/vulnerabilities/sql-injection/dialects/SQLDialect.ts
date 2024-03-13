export interface SQLDialect {
  // Use this to add keywords that are specific to the SQL dialect
  getKeywords(): string[];
}
