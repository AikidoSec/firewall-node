export type IdorProtectionConfig = {
  tenantColumnName: string;
  excludedTables: string[];
  // When true, a query with no resolved tenant (no setTenantId() on the request
  // and no runWithTenant() around background work) is blocked. Defaults to false,
  // which skips such queries instead.
  requireTenantId?: boolean;
};
