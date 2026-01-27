# IDOR Protection

IDOR (Insecure Direct Object Reference) protection ensures that every SQL query filters on a tenant column, preventing one tenant from accessing another tenant's data. Zen analyzes SQL queries at runtime and throws an error if a query is missing a tenant filter or uses the wrong tenant ID.

## Setup

### 1. Enable IDOR protection at startup

```js
const Zen = require("@aikidosec/firewall");

Zen.enableIdorProtection({
  tenantColumnName: "tenant_id",
  excludedTables: ["users"],
});
```

- `tenantColumnName` — the column name that identifies the tenant in your database tables.
- `excludedTables` — tables that don't need a tenant filter (e.g. the users table itself).

### 2. Set the tenant ID per request

Every request must have a tenant ID when IDOR protection is enabled. Call `setTenantId` early in your request handler (e.g. in middleware after authentication):

```js
const Zen = require("@aikidosec/firewall");

app.use((req, res, next) => {
  // Get the tenant ID from your authentication layer
  Zen.setTenantId(req.user.organizationId);

  next();
});
```

If `setTenantId` is not called for a request, Zen will throw an error when a SQL query is executed.

### 3. Bypass for specific queries (optional)

Some queries don't need tenant filtering (e.g. aggregations across all tenants for an admin dashboard). Use `withoutIdorProtection` to bypass the check for a specific callback:

```js
const Zen = require("@aikidosec/firewall");

// IDOR checks are skipped for queries inside this callback
const result = await Zen.withoutIdorProtection(async () => {
  return db.query("SELECT count(*) FROM agents WHERE status = 'running'");
});
```

## Error examples

**Missing tenant filter:**

```
Zen IDOR protection: query on table 'orders' is missing a filter on column 'tenant_id'
```

This means you have a query like `SELECT * FROM orders WHERE status = 'active'` that doesn't filter on `tenant_id`.

**Wrong tenant ID value:**

```
Zen IDOR protection: query on table 'orders' filters 'tenant_id' with value '456' but tenant ID is '123'
```

This means the query filters on `tenant_id`, but the value doesn't match the tenant ID set via `setTenantId`.

**Missing setTenantId call:**

```
Zen IDOR protection: setTenantId() was not called for this request. Every request must have a tenant ID when IDOR protection is enabled.
```

## Supported databases

- MySQL (via `mysql` and `mysql2` packages)

## Notes

- IDOR protection always throws on violations regardless of block/detect mode. A missing tenant filter is a developer bug, not an external attack.
- Only `SELECT` queries are checked. Support for `UPDATE` and `DELETE` will be added later.
- Parse results are cached using an LRU cache, so repeated queries with the same SQL string (e.g. parameterized queries) are efficient.
