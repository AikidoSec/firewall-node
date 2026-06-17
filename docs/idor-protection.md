# IDOR Protection

IDOR stands for Insecure Direct Object Reference — it's when one account can access another account's data because a query doesn't properly filter by account.

If your SaaS has accounts (or organizations, workspaces, teams, ...) and uses a column like `tenant_id` to keep each account's data separate, IDOR protection ensures every SQL query filters on the correct tenant. Zen analyzes queries at runtime and throws an error if a query is missing that filter or uses the wrong tenant ID, catching mistakes like:

- A `SELECT` that forgets the tenant filter, letting one account read another's orders
- An `UPDATE` or `DELETE` without a tenant filter, letting one account modify another's data
- An `INSERT` that omits the tenant column, creating orphaned or misassigned rows

Zen catches these at runtime so they surface during development and testing, not in production. See [IDOR vulnerability explained](https://www.aikido.dev/blog/idor-vulnerability-explained) for more background.

> [!IMPORTANT]
> IDOR protection always throws an `Error` on violations regardless of block/detect mode. A missing filter is a developer bug, not an external attack.

## Setup

### 1. Enable IDOR protection at startup

```js
import Zen from "@aikidosec/firewall";

Zen.enableIdorProtection({
  tenantColumnName: "tenant_id",
  excludedTables: ["users"],
  requireTenantId: true,
});
```

- `tenantColumnName` — the column name that identifies the tenant in your database tables (e.g. `account_id`, `organization_id`, `team_id`).
- `excludedTables` — tables that Zen should skip IDOR checks for, because rows aren't scoped to a single tenant (e.g. a shared `users` table that stores users across all tenants).
- `requireTenantId` — when `true`, Zen also blocks queries that run outside a web request without a tenant. Defaults to `false`, which skips those queries.

> [!TIP]
> We recommend `requireTenantId: true`.
>
> Inside a web request, Zen already requires a tenant. If you forget `setTenantId`, the query throws an error. But code that runs on its own (timers, queues, cron jobs) has no request, so by default Zen skips it. If you forget to wrap that code in `runWithTenant`, the query runs with no check and nothing warns you.
>
> With `requireTenantId: true`, Zen throws for those queries too, so a missing `runWithTenant` shows up right away. It's `false` by default because turning it on blocks every query that runs without a tenant, which can break existing background code. Turn it on once all your background work uses `runWithTenant`.

### 2. Set the tenant ID for each request

Call `setTenantId` near the start of each request, usually in middleware right after you know who the user is. Zen then checks every query in that request against this tenant:

```js
import Zen from "@aikidosec/firewall";

app.use((req, res, next) => {
  // Get the tenant ID from your authentication layer
  Zen.setTenantId(req.user.organizationId);

  next();
});
```

The tenant stays set for the rest of the request. If a request runs a query without calling `setTenantId` first, Zen throws an `Error`.

### 3. Set the tenant ID for background work

`setTenantId` only works inside a web request. For code that runs on its own, like timers, cron jobs, and queue workers, use `runWithTenant` instead. Every query inside the callback is checked against the tenant you pass.

A timer that processes jobs for many tenants:

```js
import Zen from "@aikidosec/firewall";

setInterval(async () => {
  const jobs = await getPendingJobs(); // jobs from many tenants

  for (const job of jobs) {
    await Zen.runWithTenant(job.tenantId, async () => {
      await db.query(
        "UPDATE jobs SET status = 'done' WHERE id = $1 AND tenant_id = $2",
        [job.id, job.tenantId]
      );
    });
  }
}, 60_000);
```

There is no web request here, so `setTenantId` can't help. If you forget `runWithTenant` and `requireTenantId` is on, Zen throws so you notice the missing tenant.

A job queue (for example [p-queue](https://github.com/sindresorhus/p-queue)):

```js
import PQueue from "p-queue";
import Zen from "@aikidosec/firewall";

const queue = new PQueue({ concurrency: 1 });

function schedule(tenantId, work) {
  // Run the work with its own tenant, no matter when the queue gets to it.
  return queue.add(() => Zen.runWithTenant(tenantId, work));
}

schedule(order.tenantId, async () => {
  await db.query(
    "UPDATE orders SET status = 'shipped' WHERE id = $1 AND tenant_id = $2",
    [order.id, order.tenantId]
  );
});
```

A queue usually runs a job later than when you added it. By then a different web request might be the one driving the queue, and that request can belong to another tenant. Without `runWithTenant`, Zen would check your query against that other tenant and throw, even though your code is correct. `runWithTenant` locks the right tenant onto the job, so the check always uses the one you meant.

> [!NOTE]
> Use an `async` callback and `await` your queries inside it. If the callback returns a promise without awaiting it, the query runs after the callback ends and the tenant is already gone. Zen logs a warning when it sees this.

### 4. Bypass for specific queries (optional)

Some queries don't need tenant filtering (e.g. aggregations across all tenants for an admin dashboard). Use `withoutIdorProtection` to bypass the check for a specific callback:

```js
import Zen from "@aikidosec/firewall";

// IDOR checks are skipped for queries inside this callback
const result = await Zen.withoutIdorProtection(async () => {
  return await db.query("SELECT count(*) FROM agents WHERE status = 'running'");
});
```

## Troubleshooting

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
<summary>Missing tenant ID</summary>

```
Zen IDOR protection: setTenantId() was not called for this request (use runWithTenant(...) for background work). A tenant ID is required for every query.
```

In a web request, call `setTenantId` before running queries. For background work, wrap it in `runWithTenant`. This error fires for queries outside a request only when `requireTenantId` is enabled.

</details>

## Supported databases

- MySQL (via `mysql` and `mysql2` packages)
- PostgreSQL (via `pg` package)
- SQLite (via `better-sqlite3` and `node:sqlite` packages)

Any ORM or query builder that uses these database packages under the hood is supported (e.g. Drizzle, Knex, Sequelize, TypeORM). ORMs that use their own database engine (e.g. Prisma) are not supported unless configured to use a supported driver adapter.

> [!NOTE]
> If you're using ESM, check the [ESM caveats](esm.md) — queries inside uninstrumented ESM sub-dependencies cannot be checked by Zen.

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
// Zen will still throw — the query runs after the callback exits, so IDOR protection is re-enabled
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

## Statements that are always allowed

Zen only checks statements that read or modify row data (`SELECT`, `INSERT`, `UPDATE`, `DELETE`). The following statement types are also recognized and never trigger an IDOR error:

- DDL — `CREATE TABLE`, `ALTER TABLE`, `DROP TABLE`, ...
- Session commands — `SET`, `SHOW`, ...
- Transactions — `BEGIN`, `COMMIT`, `ROLLBACK`, ...
