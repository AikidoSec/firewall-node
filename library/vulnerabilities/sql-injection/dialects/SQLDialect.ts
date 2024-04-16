export interface SQLDialect {
  // Use this to add dangerous strings that are specific to the SQL dialect
  // These are matched without surrounding spaces, so if you add "SELECT" it will match "SELECT" and "SELECTED"
  getDangerousStrings(): string[];

  // Use this to add keywords that are specific to the SQL dialect
  // These are matched with surrounding spaces, so if you add "SELECT" it will match "SELECT" but not "SELECTED"
  getKeywords(): { keyword: string; ignoreExact: boolean }[];
}
