import * as t from "tap";
import { buildRouteFromURL } from "./buildRouteFromURL";

t.test("it returns undefined for invalid URLs", async () => {
  t.same(buildRouteFromURL(""), undefined);
  t.same(buildRouteFromURL("http"), undefined);
});

t.test("it returns / for root URLs", async () => {
  t.same(buildRouteFromURL("/"), "/");
  t.same(buildRouteFromURL("http://localhost/"), "/");
});

t.test("it replaces numbers", async () => {
  t.same(buildRouteFromURL("/posts/3"), "/posts/:number");
  t.same(buildRouteFromURL("http://localhost/posts/3"), "/posts/:number");
  t.same(buildRouteFromURL("http://localhost/posts/3/"), "/posts/:number");
  t.same(
    buildRouteFromURL("http://localhost/posts/3/comments/10"),
    "/posts/:number/comments/:number"
  );
  t.same(
    buildRouteFromURL("/blog/2023/05/great-article"),
    "/blog/:number/:number/great-article"
  );
});

t.test("it replaces dates", async () => {
  t.same(buildRouteFromURL("/posts/2023-05-01"), "/posts/:date");
  t.same(buildRouteFromURL("/posts/2023-05-01/"), "/posts/:date");
  t.same(
    buildRouteFromURL("/posts/2023-05-01/comments/2023-05-01"),
    "/posts/:date/comments/:date"
  );
  t.same(buildRouteFromURL("/posts/01-05-2023"), "/posts/:date");
});

t.test("it ignores comma numbers", async () => {
  t.same(buildRouteFromURL("/posts/3,000"), "/posts/3,000");
});

t.test("it ignores API version numbers", async () => {
  t.same(buildRouteFromURL("/v1/posts/3"), "/v1/posts/:number");
});

t.test("it replaces UUIDs v1", async () => {
  t.same(
    buildRouteFromURL("/posts/d9428888-122b-11e1-b85c-61cd3cbb3210"),
    "/posts/:uuid"
  );
});

t.test("it replaces UUIDs v2", async () => {
  t.same(
    buildRouteFromURL("/posts/000003e8-2363-21ef-b200-325096b39f47"),
    "/posts/:uuid"
  );
});

t.test("it replaces UUIDs v3", async () => {
  t.same(
    buildRouteFromURL("/posts/a981a0c2-68b1-35dc-bcfc-296e52ab01ec"),
    "/posts/:uuid"
  );
});

t.test("it replaces UUIDs v4", async () => {
  t.same(
    buildRouteFromURL("/posts/109156be-c4fb-41ea-b1b4-efe1671c5836"),
    "/posts/:uuid"
  );
});

t.test("it replaces UUIDs v5", async () => {
  t.same(
    buildRouteFromURL("/posts/90123e1c-7512-523e-bb28-76fab9f2f73d"),
    "/posts/:uuid"
  );
});

t.test("it replaces UUIDs v6", async () => {
  t.same(
    buildRouteFromURL("/posts/1ef21d2f-1207-6660-8c4f-419efbd44d48"),
    "/posts/:uuid"
  );
});

t.test("it replaces UUIDs v7", async () => {
  t.same(
    buildRouteFromURL("/posts/017f22e2-79b0-7cc3-98c4-dc0c0c07398f"),
    "/posts/:uuid"
  );
});

t.test("it replaces UUIDs v8", async () => {
  t.same(
    buildRouteFromURL("/posts/0d8f23a0-697f-83ae-802e-48f3756dd581"),
    "/posts/:uuid"
  );
});

t.test("it ignores invalid UUIDs", async () => {
  t.same(
    buildRouteFromURL("/posts/00000000-0000-1000-6000-000000000000"),
    "/posts/00000000-0000-1000-6000-000000000000"
  );
});

t.test("it ignores strings", async () => {
  t.same(buildRouteFromURL("/posts/abc"), "/posts/abc");
});

t.test("it replaces email addresses", async () => {
  t.same(buildRouteFromURL("/login/john.doe@acme.com"), "/login/:email");
});

t.test("it replaces IP addresses", async () => {
  t.same(buildRouteFromURL("/block/1.2.3.4"), "/block/:ip");
});

function generateHash(type: string) {
  return require("crypto").createHash(type).update("test").digest("hex");
}

t.test("it replaces hashes", async () => {
  t.same(buildRouteFromURL(`/files/${generateHash("md5")}`), "/files/:hash");
  t.same(buildRouteFromURL(`/files/${generateHash("sha1")}`), "/files/:hash");
  t.same(buildRouteFromURL(`/files/${generateHash("sha256")}`), "/files/:hash");
  t.same(buildRouteFromURL(`/files/${generateHash("sha512")}`), "/files/:hash");
});
