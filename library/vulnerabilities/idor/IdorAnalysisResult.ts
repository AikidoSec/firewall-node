export type TableRef = {
  name: string;
  alias?: string;
};

export type FilterColumn = {
  table?: string;
  column: string;
  operator: string;
  value: string;
  /** 0-based position of a `?` placeholder in the query (MySQL-style) */
  placeholder_number?: number;
};

export type SelectQueryResult = {
  tables: TableRef[];
  filters: FilterColumn[];
};
