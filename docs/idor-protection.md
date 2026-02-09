# IDOR Protection

IDOR (Insecure Direct Object Reference) protection ensures that every SQL query filters on a tenant column, preventing one tenant from accessing another tenant's data. Zen analyzes SQL queries at runtime and throws an error if a query is missing a tenant filter or uses the wrong tenant ID.

> [!IMPORTANT]
> IDOR protection always throws an `Error` on violations regardless of block/detect mode. A missing tenant filter is a developer bug, not an external attack.

## When to use this

If your app is multi-tenant and uses a column like `tenant_id` to separate data, IDOR protection helps you catch common mistakes:

- A `SELECT` that forgets the tenant filter, letting one tenant read another's orders
- An `UPDATE` or `DELETE` without a tenant filter, letting one tenant modify another's data
- An `INSERT` that omits the tenant column, creating orphaned or misassigned rows
- New features that reuse existing queries but forget to add tenant filtering

Zen catches these at runtime so they surface during development and testing, not in production. See [IDOR vulnerability explained](https://www.aikido.dev/blog/idor-vulnerability-explained) for more background.

## Setup

### 1. Enable IDOR protection at startup

```js
import Zen from "@aikidosec/firewall";

Zen.enableIdorProtection({
  tenantColumnName: "tenant_id",
  excludedTables: ["users"],
});
```

- `tenantColumnName` — the column name that identifies the tenant in your database tables.
- `excludedTables` — tables where rows aren't owned by a single tenant (e.g. a shared `users` table that stores users across all tenants).

### 2. Set the tenant ID per request

Every request must have a tenant ID when IDOR protection is enabled. Call `setTenantId` early in your request handler (e.g. in middleware after authentication):

```js
import Zen from "@aikidosec/firewall";

app.use((req, res, next) => {
  // Get the tenant ID from your authentication layer
  Zen.setTenantId(req.user.organizationId);

  next();
});
```

> [!IMPORTANT]
> If `setTenantId` is not called for a request, Zen will throw an `Error` when a SQL query is executed.

### 3. Bypass for specific queries (optional)

Some queries don't need tenant filtering (e.g. aggregations across all tenants for an admin dashboard). Use `withoutIdorProtection` to bypass the check for a specific callback:

```js
import Zen from "@aikidosec/firewall";

// IDOR checks are skipped for queries inside this callback
const result = await Zen.withoutIdorProtection(async () => {
  return db.query("SELECT count(*) FROM agents WHERE status = 'running'");
});
```

## Error examples

<details>
<summary>Missing tenant filter</summary>

```
Zen IDOR protection: query on table 'orders' is missing a filter on column 'tenant_id'
```

This means you have a query like `SELECT * FROM orders WHERE status = 'active'` that doesn't filter on `tenant_id`. The same check applies to `UPDATE` and `DELETE` queries.

</details>

<details>
<summary>Wrong tenant ID value</summary>

```
Zen IDOR protection: query on table 'orders' filters 'tenant_id' with value '456' but tenant ID is '123'
```

This means the query filters on `tenant_id`, but the value doesn't match the tenant ID set via `setTenantId`.

</details>

<details>
<summary>Missing tenant column in INSERT</summary>

```
Zen IDOR protection: INSERT on table 'orders' is missing column 'tenant_id'
```

This means an `INSERT` statement doesn't include the tenant column. Every INSERT must include the tenant column with the correct tenant ID value.

</details>

<details>
<summary>Wrong tenant ID in INSERT</summary>

```
Zen IDOR protection: INSERT on table 'orders' sets 'tenant_id' to '456' but tenant ID is '123'
```

This means the INSERT includes the tenant column, but the value doesn't match the tenant ID set via `setTenantId`.

</details>

<details>
<summary>Missing setTenantId call</summary>

```
Zen IDOR protection: setTenantId() was not called for this request. Every request must have a tenant ID when IDOR protection is enabled.
```

</details>

## Supported databases

- MySQL (via `mysql` and `mysql2` packages)
- PostgreSQL (via `pg` package)

Any ORM or query builder that uses these database packages under the hood is supported (e.g. Drizzle, Knex, Sequelize, TypeORM). ORMs that use their own database engine (e.g. Prisma) are not supported unless configured to use a supported driver adapter.

> [!NOTE]
> If you're using ESM, check the [ESM caveats](esm.md) — queries inside uninstrumented ESM sub-dependencies cannot be checked by Zen.

## Supported SQL statements

- `SELECT` — checks that the WHERE clause filters on the tenant column with the correct value
- `INSERT` — checks that the tenant column is included with the correct value
- `UPDATE` — checks that the WHERE clause filters on the tenant column with the correct value
- `DELETE` — checks that the WHERE clause filters on the tenant column with the correct value

Other statement types (DDL like `CREATE TABLE`, session commands like `SET`, etc.) are safely ignored.

## Limitations

### MySQL bulk insert syntax

The `mysql` and `mysql2` packages support a shorthand for bulk inserts using `VALUES ?` with nested arrays:

```js
connection.query("INSERT INTO orders (name, tenant_id) VALUES ?", [
  [
    ["Widget", "org_123"],
    ["Gadget", "org_123"],
  ],
]);
```

This syntax is not standard SQL and cannot be analyzed by Zen. Wrap these calls with `withoutIdorProtection()`:

```js
await Zen.withoutIdorProtection(async () => {
  return connection.query("INSERT INTO orders (name, tenant_id) VALUES ?", [
    [
      ["Widget", "org_123"],
      ["Gadget", "org_123"],
    ],
  ]);
});
```

Alternatively, use explicit placeholders which Zen can analyze:

```js
connection.query("INSERT INTO orders (name, tenant_id) VALUES (?, ?), (?, ?)", [
  "Widget",
  "org_123",
  "Gadget",
  "org_123",
]);
```

### MySQL INSERT ... SET ? with object

The `mysql` and `mysql2` packages support inserting a row using an object with `SET ?`:

```js
connection.query("INSERT INTO orders SET ?", {
  name: "Widget",
  tenant_id: "org_123",
});
```

The driver expands this to `INSERT INTO orders SET name = 'Widget', tenant_id = 'org_123'`, but Zen sees the unexpanded `SET ?` which is not parseable. Wrap these calls with `withoutIdorProtection()`, or use explicit placeholders:

```js
connection.query("INSERT INTO orders (name, tenant_id) VALUES (?, ?)", [
  "Widget",
  "org_123",
]);
```

### `withoutIdorProtection()` requires `await` inside the callback

When using `withoutIdorProtection` with async code, you must use an `async` callback and `await` the query inside it. Otherwise the query completes after the callback exits and IDOR protection won't be disabled:

```js
// Does NOT work — missing async/await, the query resolves after the callback exits
await Zen.withoutIdorProtection(() =>
  db.query.orders.findFirst({ columns: { id: true } })
);

// Works — async callback with await ensures the query completes before the callback exits
await Zen.withoutIdorProtection(async () => {
  return await db.query.orders.findFirst({ columns: { id: true } });
});
```

> [!NOTE]
> Zen will log a warning to the console if it detects this pattern.

