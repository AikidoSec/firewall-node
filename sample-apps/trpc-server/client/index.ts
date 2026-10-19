import {
  createTRPCClient,
  httpBatchStreamLink,
  httpSubscriptionLink,
  splitLink,
} from "@trpc/client";

import type { AppRouter } from "../server/router.js";
import { deepEqual, rejects } from "assert/strict";

const port = process.env.PORT || "4000";
const path = process.env.PATH || "";

const trpc = createTRPCClient<AppRouter>({
  links: [
    splitLink({
      condition: (op) => op.type === "subscription",
      true: httpSubscriptionLink({
        url: `http://localhost:${port}`,
      }),
      false: httpBatchStreamLink({
        url: `http://localhost:${port}`,
      }),
    }),
  ],
});

async function main() {
  const expectBlocking = process.env.AIKIDO_BLOCK === "true";

  await trpc.cats.reset.mutate();

  const cats = await trpc.cats.list.query();

  deepEqual(cats, [], "Cats should be empty initially");

  const createdCat = await trpc.cats.create.mutate({ name: "miau" });

  deepEqual(
    createdCat,
    { changes: 1, lastInsertRowid: 1 },
    "Cat should be created"
  );

  const cat = await trpc.cats.byName.query("miau");
  deepEqual(cat, { petname: "miau" }, "Cat should be found by name");

  if (expectBlocking) {
    await rejects(
      () => trpc.cats.byName.query("test' OR '1'='1"),
      "SQL injection should be blocked"
    );
  } else {
    const injectedCat = await trpc.cats.byName.query("' OR '1'='1");
    deepEqual(
      injectedCat,
      { petname: "miau" },
      "SQL injection should return the first cat"
    );
  }

  process.exit(0);
}

void main();
