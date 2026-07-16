# IDOR Protection

IDOR (Insecure Direct Object Reference) is when one account can read or change another account's data because a query forgot to filter by account.

If your app has accounts (or organizations, workspaces, teams, ...) and keeps each account's data apart with a column like `tenant_id`, Zen makes sure every SQL query filters on the right tenant. It checks queries at runtime and throws an error when one is missing the filter or uses the wrong tenant ID. For example:

- A `SELECT` without the tenant filter, so one account can read another's orders
- An `UPDATE` or `DELETE` without the filter, so one account can change another's data
- An `INSERT` that leaves out the tenant column, creating rows that belong to nobody or the wrong account

Most of the time this is a bug you'll catch in development or testing. Sometimes it's an actual attack. Either way, Zen blocks the query before it runs. See [IDOR vulnerability explained](https://www.aikido.dev/blog/idor-vulnerability-explained) for more.

> [!NOTE]
> IDOR violations always throw, even in detection-only mode (unlike SQL injection, which Zen blocks or just reports depending on your mode).

## Setup

### 1. Turn it on at startup

```js
import Zen from "@aikidosec/firewall";

Zen.enableIdorProtection({
  tenantColumnName: "tenant_id",
  excludedTables: ["users"],
});
```

- `tenantColumnName` — the column that says which tenant a row belongs to (e.g. `account_id`, `organization_id`, `team_id`).
- `excludedTables` — tables to skip, because their rows aren't tied to one tenant (e.g. a shared `users` table with users from every account).

### 2. Set the tenant ID on each request

Call `setTenantId` early in the request, usually in middleware once you know who the user is. Zen then checks every query in that request against this tenant:

```js
import Zen from "@aikidosec/firewall";

app.use((req, res, next) => {
  // Get the tenant ID from your auth layer
  Zen.setTenantId(req.user.organizationId);

  next();
});
```

The tenant stays set for the rest of the request. If a query runs and you never called `setTenantId`, Zen throws.

That's everything you need for code that runs inside requests. The sections below are optional.

## Supported databases

- MySQL (via `mysql` and `mysql2`)
- PostgreSQL (via `pg`)
- SQLite (via `better-sqlite3` and `node:sqlite`)

Any ORM or query builder built on these drivers works too (Drizzle, Knex, Sequelize, TypeORM). ORMs with their own engine (like Prisma) aren't supported unless you point them at a supported driver.

> [!NOTE]
> On ESM, see the [ESM caveats](esm.md) — Zen can't check queries inside ESM sub-dependencies it didn't instrument.

## Advanced options

<details>
<summary>Background work: set the tenant ID for timers, queues, and cron jobs</summary>

`setTenantId` only works inside a web request. For code that runs outside HTTP requests, use `runWithTenant`. Every query inside the callback is checked against the tenant you pass in, including queries in any functions and async operations the callback calls.

A timer that handles jobs from many tenants:

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

A job queue (like [p-queue](https://github.com/sindresorhus/p-queue)):

```js
import PQueue from "p-queue";
import Zen from "@aikidosec/firewall";

const queue = new PQueue({ concurrency: 1 });

function schedule(tenantId, work) {
  // Pin the work to its own tenant, no matter when the queue runs it
  return queue.add(() => Zen.runWithTenant(tenantId, work));
}

schedule(order.tenantId, async () => {
  await db.query(
    "UPDATE orders SET status = 'shipped' WHERE id = $1 AND tenant_id = $2",
    [order.id, order.tenantId]
  );
});
```

A queue runs jobs later than when you add them. By then a different request might be driving the queue, and that request can belong to another tenant. `runWithTenant` pins the right tenant to the job, so the check always uses the one you meant.

> [!NOTE]
> Use an `async` callback and `await` your queries inside it. If you return a promise without awaiting it, the query runs after the callback ends and the tenant is gone. Zen logs a warning when it spots this.

</details>

<details>
<summary>Require a tenant ID for every query</summary>

```js
Zen.enableIdorProtection({
  tenantColumnName: "tenant_id",
  requireTenantId: true,
});
```

By default, queries that run outside a request with no tenant set are skipped. With `requireTenantId: true`, Zen throws for those too, so a forgotten `runWithTenant` shows up instead of quietly running unchecked.

This is stricter, for teams that have fully adopted IDOR protection. It's off by default because turning it on blocks every query that runs without a tenant, which can break existing background code. Only turn it on once all your background work uses `runWithTenant`.

</details>

<details>
<summary>Read the current tenant ID</summary>

`getTenantId` returns the tenant set right now. It works inside a request (set with `setTenantId`) and inside `runWithTenant`. Handy when you need the tenant deep in your code and don't want to pass it through every function:

```js
import Zen from "@aikidosec/firewall";

function enqueueJob(work) {
  const tenantId = Zen.getTenantId();

  return queue.add(() => Zen.runWithTenant(tenantId, work));
}
```

It returns a string, or `undefined` if no tenant is set. If both are set, `runWithTenant` wins over `setTenantId`.

</details>

<details>
<summary>Skip the check for specific queries</summary>

Some queries don't need a tenant filter, like an admin dashboard that counts across all tenants. Wrap them in `withoutIdorProtection`:

```js
import Zen from "@aikidosec/firewall";

// IDOR checks are skipped for queries in this callback
const result = await Zen.withoutIdorProtection(async () => {
  return await db.query("SELECT count(*) FROM agents WHERE status = 'running'");
});
```

Use an `async` callback and `await` the query inside it. If you don't, the query finishes after the callback exits and the check is back on:

```js
// Still throws — the query runs after the callback exits, so the check is back on
await Zen.withoutIdorProtection(() =>
  db.query.orders.findFirst({ columns: { id: true } })
);

// Works — await makes the query finish before the callback exits
await Zen.withoutIdorProtection(async () => {
  return await db.query.orders.findFirst({ columns: { id: true } });
});
```

Zen logs a warning if it spots the broken version.

</details>

## Troubleshooting

<details>
<summary>Missing tenant filter</summary>

```
Zen IDOR protection: query on table 'orders' is missing a filter on column 'tenant_id'
```

You have a query like `SELECT * FROM orders WHERE status = 'active'` with no `tenant_id` filter. Same check applies to `UPDATE` and `DELETE`.

</details>

<details>
<summary>Wrong tenant ID value</summary>

```
Zen IDOR protection: query on table 'orders' filters 'tenant_id' with value '456' but tenant ID is '123'
```

The query filters on `tenant_id`, but the value doesn't match the tenant set with `setTenantId`.

</details>

<details>
<summary>Missing tenant column in INSERT</summary>

```
Zen IDOR protection: INSERT on table 'orders' is missing column 'tenant_id'
```

An `INSERT` doesn't include the tenant column. Every INSERT needs it, with the right value.

</details>

<details>
<summary>Wrong tenant ID in INSERT</summary>

```
Zen IDOR protection: INSERT on table 'orders' sets 'tenant_id' to '456' but tenant ID is '123'
```

The INSERT has the tenant column, but the value doesn't match the tenant set with `setTenantId`.

</details>

<details>
<summary>Missing tenant ID</summary>

```
Zen IDOR protection: setTenantId() was not called for this request (use runWithTenant(...) for background work). A tenant ID is required for every query.
```

Inside a request, call `setTenantId` before running queries. For background work, wrap it in `runWithTenant`. This one only fires for queries outside a request when `requireTenantId` is on.

</details>

## Limitations

<details>
<summary>MySQL bulk insert with <code>VALUES ?</code></summary>

`mysql` and `mysql2` support a shorthand for bulk inserts with `VALUES ?` and nested arrays:

```js
connection.query("INSERT INTO orders (name, tenant_id) VALUES ?", [
  [
    ["Widget", "org_123"],
    ["Gadget", "org_123"],
  ],
]);
```

This isn't standard SQL, so Zen can't read it. Wrap these in `withoutIdorProtection()`, or use explicit placeholders Zen can read:

```js
connection.query("INSERT INTO orders (name, tenant_id) VALUES (?, ?), (?, ?)", [
  "Widget",
  "org_123",
  "Gadget",
  "org_123",
]);
```

</details>

<details>
<summary>MySQL <code>INSERT ... SET ?</code> with an object</summary>

`mysql` and `mysql2` let you insert a row from an object with `SET ?`:

```js
connection.query("INSERT INTO orders SET ?", {
  name: "Widget",
  tenant_id: "org_123",
});
```

The driver turns this into `INSERT INTO orders SET name = 'Widget', tenant_id = 'org_123'`, but Zen only sees the raw `SET ?`, which it can't parse. Wrap it in `withoutIdorProtection()`, or use explicit placeholders:

```js
connection.query("INSERT INTO orders (name, tenant_id) VALUES (?, ?)", [
  "Widget",
  "org_123",
]);
```

</details>

## Statements that always pass

Zen only checks statements that read or change rows (`SELECT`, `INSERT`, `UPDATE`, `DELETE`). It recognizes these too, and they never trigger an IDOR error:

- DDL — `CREATE TABLE`, `ALTER TABLE`, `DROP TABLE`, ...
- Session commands — `SET`, `SHOW`, ...
- Transactions — `BEGIN`, `COMMIT`, `ROLLBACK`, ...
