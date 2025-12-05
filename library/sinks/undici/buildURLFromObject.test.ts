import * as t from "tap";
import { buildURLFromArgs } from "./buildURLFromObject";
import { parse as parseUrl } from "url";

t.test("empty", async (t) => {
  const url = buildURLFromArgs([]);
  t.same(url, undefined);
});

t.test("it returns an URL instance", async (t) => {
  const url = buildURLFromArgs(["http://localhost:4000"]);
  t.ok(url instanceof URL);
});

t.test("it returns the full url", async () => {
  t.same(
    buildURLFromArgs([
      { origin: "http://localhost:4000", pathname: "/api", search: "?page=1" },
    ])?.toString(),
    "http://localhost:4000/api?page=1"
  );
  t.same(
    buildURLFromArgs([
      { origin: "http://localhost:4000", path: "/api?page=1" },
    ])?.toString(),
    "http://localhost:4000/api?page=1"
  );
});

t.test("origin ends with slash", async (t) => {
  t.same(
    buildURLFromArgs([
      { origin: "http://localhost:4000/", pathname: "/api", search: "?page=1" },
    ])?.toString(),
    "http://localhost:4000/api?page=1"
  );
  t.same(
    buildURLFromArgs([
      { origin: "http://localhost:4000/", path: "/api?page=1" },
    ])?.toString(),
    "http://localhost:4000/api?page=1"
  );
});

t.test("it works with url string", async (t) => {
  t.same(
    buildURLFromArgs(["http://localhost:4000"])?.toString(),
    "http://localhost:4000/"
  );
  t.same(
    buildURLFromArgs(["http://localhost?test=1"])?.toString(),
    "http://localhost/?test=1"
  );
  t.same(
    buildURLFromArgs(["https://localhost"])?.toString(),
    "https://localhost/"
  );
});

t.test("it works with url object", async (t) => {
  t.same(
    buildURLFromArgs([new URL("http://localhost:4000")])?.toString(),
    "http://localhost:4000/"
  );
  t.same(
    buildURLFromArgs([new URL("http://localhost?test=1")])?.toString(),
    "http://localhost/?test=1"
  );
  t.same(
    buildURLFromArgs([new URL("https://localhost")])?.toString(),
    "https://localhost/"
  );
});

t.test("it works with an array of strings", async (t) => {
  t.same(
    buildURLFromArgs([["http://localhost:4000"]])?.toString(),
    "http://localhost:4000/"
  );
  t.same(
    buildURLFromArgs([["http://localhost?test=1"]])?.toString(),
    "http://localhost/?test=1"
  );
  t.same(
    buildURLFromArgs([["https://localhost"]])?.toString(),
    "https://localhost/"
  );
});

t.test("it works with an legacy url object", async (t) => {
  t.same(
    buildURLFromArgs([parseUrl("http://localhost:4000")])?.toString(),
    "http://localhost:4000/"
  );
  t.same(
    buildURLFromArgs([parseUrl("http://localhost?test=1")])?.toString(),
    "http://localhost/?test=1"
  );
  t.same(
    buildURLFromArgs([parseUrl("https://localhost")])?.toString(),
    "https://localhost/"
  );
});

t.test("it works with an options object containing origin", async (t) => {
  t.same(
    buildURLFromArgs([{ origin: "http://localhost:4000" }])?.toString(),
    "http://localhost:4000/"
  );
  t.same(
    buildURLFromArgs([
      { origin: "http://localhost", search: "?test=1" },
    ])?.toString(),
    "http://localhost/?test=1"
  );
  t.same(
    buildURLFromArgs([{ origin: "https://localhost" }])?.toString(),
    "https://localhost/"
  );
});

t.test(
  "it works with an options object containing protocol, hostname and port",
  async (t) => {
    t.same(
      buildURLFromArgs([
        { protocol: "http:", hostname: "localhost", port: 4000 },
      ])?.toString(),
      "http://localhost:4000/"
    );
    t.same(
      buildURLFromArgs([
        { protocol: "https:", hostname: "localhost" },
      ])?.toString(),
      "https://localhost/"
    );
  }
);

t.test("invalid origin url", async (t) => {
  t.same(buildURLFromArgs([{ origin: "invalid url" }]), undefined);
  t.same(buildURLFromArgs([{ origin: "" }]), undefined);
});

t.test("without hostname", async (t) => {
  t.same(buildURLFromArgs([{}]), undefined);
  t.same(buildURLFromArgs([{ protocol: "https:", port: 4000 }]), undefined);
});
