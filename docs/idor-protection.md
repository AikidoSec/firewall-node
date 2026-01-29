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

This means you have a query like `SELECT * FROM orders WHERE status = 'active'` that doesn't filter on `tenant_id`. The same check applies to `UPDATE` and `DELETE` queries.

**Wrong tenant ID value:**

```
Zen IDOR protection: query on table 'orders' filters 'tenant_id' with value '456' but tenant ID is '123'
```

This means the query filters on `tenant_id`, but the value doesn't match the tenant ID set via `setTenantId`.

**Missing tenant column in INSERT:**

```
Zen IDOR protection: INSERT on table 'orders' is missing column 'tenant_id'
```

This means an `INSERT` statement doesn't include the tenant column. Every INSERT must include the tenant column with the correct tenant ID value.

**Wrong tenant ID in INSERT:**

```
Zen IDOR protection: INSERT on table 'orders' sets 'tenant_id' to '456' but tenant ID is '123'
```

This means the INSERT includes the tenant column, but the value doesn't match the tenant ID set via `setTenantId`.

**Missing setTenantId call:**

```
Zen IDOR protection: setTenantId() was not called for this request. Every request must have a tenant ID when IDOR protection is enabled.
```

## Supported databases

- MySQL (via `mysql` and `mysql2` packages)
- PostgreSQL (via `pg` package)

## Supported SQL statements

- `SELECT` — checks that the WHERE clause filters on the tenant column
- `INSERT` — checks that the tenant column is included with the correct value
- `UPDATE` — checks that the WHERE clause filters on the tenant column
- `DELETE` — checks that the WHERE clause filters on the tenant column

Unsupported statement types (e.g. DDL like `CREATE TABLE`) will throw an error. Use `withoutIdorProtection()` to bypass the check for those queries.

## Limitations

### MySQL bulk insert syntax

The `mysql` and `mysql2` packages support a shorthand for bulk inserts using `VALUES ?` with nested arrays:

```js
connection.query('INSERT INTO orders (name, tenant_id) VALUES ?', [
  [['Widget', 'org_123'], ['Gadget', 'org_123']]
]);
```

This syntax is not standard SQL and cannot be analyzed by Zen. Wrap these calls with `withoutIdorProtection()`:

```js
await Zen.withoutIdorProtection(async () => {
  return connection.query('INSERT INTO orders (name, tenant_id) VALUES ?', [
    [['Widget', 'org_123'], ['Gadget', 'org_123']]
  ]);
});
```

Alternatively, use explicit placeholders which Zen can analyze:

```js
connection.query(
  'INSERT INTO orders (name, tenant_id) VALUES (?, ?), (?, ?)',
  ['Widget', 'org_123', 'Gadget', 'org_123']
);
```

### MySQL INSERT ... SET ? with object

The `mysql` and `mysql2` packages support inserting a row using an object with `SET ?`:

```js
connection.query('INSERT INTO orders SET ?', { name: 'Widget', tenant_id: 'org_123' });
```

The driver expands this to `INSERT INTO orders SET name = 'Widget', tenant_id = 'org_123'`, but Zen sees the unexpanded `SET ?` which is not parseable. Wrap these calls with `withoutIdorProtection()`, or use explicit placeholders:

```js
connection.query(
  'INSERT INTO orders (name, tenant_id) VALUES (?, ?)',
  ['Widget', 'org_123']
);
```

### OR clauses (planned)

Zen checks that a query filters on the tenant column, but does not yet verify that the filter cannot be bypassed with an `OR` clause. For example:

```sql
SELECT * FROM orders WHERE tenant_id = $1 OR public = true
```

This query passes the IDOR check because `tenant_id` is present as a filter, but the `OR public = true` condition could return rows from other tenants.

### CTEs (WITH clauses) (planned)

Queries using Common Table Expressions (WITH clauses) are not yet supported and will throw an error. Wrap these calls with `withoutIdorProtection()` for now:

```js
await Zen.withoutIdorProtection(async () => {
  return db.query(`
    WITH active_orders AS (SELECT * FROM orders WHERE status = 'active')
    SELECT * FROM active_orders WHERE tenant_id = $1
  `, [tenantId]);
});
```

## Notes

- IDOR protection always throws on violations regardless of block/detect mode. A missing tenant filter is a developer bug, not an external attack.
- Parse results are cached using an LRU cache, so repeated queries with the same SQL string (e.g. parameterized queries) are efficient.
