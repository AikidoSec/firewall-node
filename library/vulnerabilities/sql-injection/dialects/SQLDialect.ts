export interface SQLDialect {
  getWASMDialectInt(): number;
  getHumanReadableName(): string;
}
