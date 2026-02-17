export type TableRef = {
  name: string;
  alias?: string;
};

export type FilterColumn = {
  table?: string;
  column: string;
  value: string;
  /** 0-based position of a `?` placeholder in the query (MySQL-style) */
  placeholder_number?: number;
  /** Whether the value is a placeholder (e.g. `?`, `$1`) rather than a literal */
  is_placeholder: boolean;
};

export type InsertColumn = {
  column: string;
  value: string;
  /** 0-based position of a `?` placeholder in the query (MySQL-style) */
  placeholder_number?: number;
  /** Whether the value is a placeholder (e.g. `?`, `$1`) rather than a literal */
  is_placeholder: boolean;
};

export type SqlQueryResult = {
  kind: "select" | "insert" | "update" | "delete";
  tables: TableRef[];
  filters: FilterColumn[];
  /** For INSERT statements: column-value pairs for each row */
  insert_columns?: InsertColumn[][];
};
