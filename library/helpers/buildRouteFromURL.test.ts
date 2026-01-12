import * as t from "tap";
import { buildRouteFromURL, compileCustomPattern } from "./buildRouteFromURL";
import * as ObjectID from "bson-objectid";
import { createHash } from "crypto";

t.test("it returns undefined for invalid URLs", async () => {
  t.same(buildRouteFromURL("", []), undefined);
  t.same(buildRouteFromURL("http", []), undefined);
});

t.test("it returns / for root URLs", async () => {
  t.same(buildRouteFromURL("/", []), "/");
  t.same(buildRouteFromURL("http://localhost/", []), "/");
});

t.test("it replaces numbers", async () => {
  t.same(buildRouteFromURL("/posts/3", []), "/posts/:number");
  t.same(buildRouteFromURL("http://localhost/posts/3", []), "/posts/:number");
  t.same(buildRouteFromURL("http://localhost/posts/3/", []), "/posts/:number");
  t.same(
    buildRouteFromURL("http://localhost/posts/3/comments/10", []),
    "/posts/:number/comments/:number"
  );
  t.same(
    buildRouteFromURL("/blog/2023/05/great-article", []),
    "/blog/:number/:number/great-article"
  );
});

t.test("it replaces dates", async () => {
  t.same(buildRouteFromURL("/posts/2023-05-01", []), "/posts/:date");
  t.same(buildRouteFromURL("/posts/2023-05-01/", []), "/posts/:date");
  t.same(
    buildRouteFromURL("/posts/2023-05-01/comments/2023-05-01", []),
    "/posts/:date/comments/:date"
  );
  t.same(buildRouteFromURL("/posts/01-05-2023", []), "/posts/:date");
});

t.test("it ignores API version numbers", async () => {
  t.same(buildRouteFromURL("/v1/posts/3", []), "/v1/posts/:number");
});

t.test("it replaces UUIDs v1", async () => {
  t.same(
    buildRouteFromURL("/posts/d9428888-122b-11e1-b85c-61cd3cbb3210", []),
    "/posts/:uuid"
  );
});

t.test("it replaces UUIDs v2", async () => {
  t.same(
    buildRouteFromURL("/posts/000003e8-2363-21ef-b200-325096b39f47", []),
    "/posts/:uuid"
  );
});

t.test("it replaces UUIDs v3", async () => {
  t.same(
    buildRouteFromURL("/posts/a981a0c2-68b1-35dc-bcfc-296e52ab01ec", []),
    "/posts/:uuid"
  );
});

t.test("it replaces UUIDs v4", async () => {
  t.same(
    buildRouteFromURL("/posts/109156be-c4fb-41ea-b1b4-efe1671c5836", []),
    "/posts/:uuid"
  );
});

t.test("it replaces UUIDs v5", async () => {
  t.same(
    buildRouteFromURL("/posts/90123e1c-7512-523e-bb28-76fab9f2f73d", []),
    "/posts/:uuid"
  );
});

t.test("it replaces UUIDs v6", async () => {
  t.same(
    buildRouteFromURL("/posts/1ef21d2f-1207-6660-8c4f-419efbd44d48", []),
    "/posts/:uuid"
  );
});

t.test("it replaces UUIDs v7", async () => {
  t.same(
    buildRouteFromURL("/posts/017f22e2-79b0-7cc3-98c4-dc0c0c07398f", []),
    "/posts/:uuid"
  );
});

t.test("it replaces UUIDs v8", async () => {
  t.same(
    buildRouteFromURL("/posts/0d8f23a0-697f-83ae-802e-48f3756dd581", []),
    "/posts/:uuid"
  );
});

t.test("it ignores invalid UUIDs", async () => {
  t.same(
    buildRouteFromURL("/posts/00000000-0000-1000-6000-000000000000", []),
    "/posts/00000000-0000-1000-6000-000000000000"
  );
});

t.test("it ignores strings", async () => {
  t.same(buildRouteFromURL("/posts/abc", []), "/posts/abc");
});

t.test("it replaces email addresses", async () => {
  t.same(buildRouteFromURL("/login/john.doe@acme.com", []), "/login/:email");
  t.same(
    buildRouteFromURL("/login/john.doe+alias@acme.com", []),
    "/login/:email"
  );
});

t.test("it replaces IP addresses", async () => {
  t.same(buildRouteFromURL("/block/1.2.3.4", []), "/block/:ip");
  t.same(
    buildRouteFromURL("/block/2001:2:ffff:ffff:ffff:ffff:ffff:ffff", []),
    "/block/:ip"
  );
  t.same(
    buildRouteFromURL("/block/64:ff9a::255.255.255.255", []),
    "/block/:ip"
  );
  t.same(buildRouteFromURL("/block/100::", []), "/block/:ip");
  t.same(buildRouteFromURL("/block/fec0::", []), "/block/:ip");
  t.same(buildRouteFromURL("/block/227.202.96.196", []), "/block/:ip");
});

function generateHash(type: string) {
  return createHash(type).update("test").digest("hex");
}

t.test("it replaces hashes", async () => {
  t.same(
    buildRouteFromURL(`/files/${generateHash("md5")}`, []),
    "/files/:hash"
  );
  t.same(
    buildRouteFromURL(`/files/${generateHash("sha1")}`, []),
    "/files/:hash"
  );
  t.same(
    buildRouteFromURL(`/files/${generateHash("sha256")}`, []),
    "/files/:hash"
  );
  t.same(
    buildRouteFromURL(`/files/${generateHash("sha512")}`, []),
    "/files/:hash"
  );
});

t.test("it replaces secrets", async () => {
  t.same(
    buildRouteFromURL("/confirm/CnJ4DunhYfv2db6T1FRfciRBHtlNKOYrjoz", []),
    "/confirm/:secret"
  );
});

t.test("it replaces BSON ObjectIDs", async () => {
  t.same(
    // @ts-expect-error It says that the expression isn't callable
    buildRouteFromURL(`/posts/${ObjectID().toHexString()}`, []),
    "/posts/:objectId"
  );
  t.same(
    buildRouteFromURL(`/posts/66ec29159d00113616fc7184`, []),
    "/posts/:objectId"
  );
});

t.test("it replaces ULID strings", async () => {
  t.same(
    buildRouteFromURL("/posts/01ARZ3NDEKTSV4RRFFQ69G5FAV", []),
    "/posts/:ulid"
  );
  t.same(
    buildRouteFromURL("/posts/01arz3ndektsv4rrffq69g5fav", []),
    "/posts/:ulid"
  );
});

t.test("test_ratelimiting_1 is not a secret", async () => {
  t.same(buildRouteFromURL("/test_ratelimiting_1", []), "/test_ratelimiting_1");
});

t.test("it does not detect static files as secrets", async () => {
  const files = [
    "ClientRouter.astro_astro_type_script_index_0_lang.AWhPxJ6s.js",
    "index.BRaz9DSe.css",
    "icon.DbNf-ftQ_Z18kUbq.svg",
    "Layout.astro_astro_type_script_index_1_lang.DBtfcKk0.js",
    "nunito-latin-wght-normal.BaTF6Vo7.woff2",
  ];

  for (const file of files) {
    t.same(buildRouteFromURL(`/assets/${file}`, []), `/assets/${file}`);
  }
});

t.test("it detects numeric comma separated arrays", async (t) => {
  t.same(buildRouteFromURL("/users/1,2", []), "/users/:array(number)");
  t.same(buildRouteFromURL("/users/1,2,3,4,5", []), "/users/:array(number)");
  t.same(
    buildRouteFromURL("/users/100,200,3000000,40000000,500000000", []),
    "/users/:array(number)"
  );

  t.same(buildRouteFromURL("/users/1,2,3,4,", []), "/users/1,2,3,4,");
  t.same(buildRouteFromURL("/users/1,", []), "/users/1,");
  t.same(buildRouteFromURL("/users/,1,2", []), "/users/,1,2");
  t.same(buildRouteFromURL("/users/1,2,3_", []), "/users/1,2,3_");
  t.same(buildRouteFromURL("/users/1,2,3a", []), "/users/1,2,3a");
});

t.test("it supports custom patterns", async () => {
  t.same(
    buildRouteFromURL("/prefix-103799/api/dashboard", [
      compileCustomPattern("prefix-{digits}")!,
    ]),
    "/:custom/api/dashboard"
  );

  t.same(
    buildRouteFromURL("/blog/01-31513/slug", [
      compileCustomPattern("{digits}-{digits}")!,
    ]),
    "/blog/:custom/slug"
  );
});
