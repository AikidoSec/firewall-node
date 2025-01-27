import * as t from "tap";
import { Hostnames } from "./Hostnames";

t.test("it works", async () => {
  const hostnames = new Hostnames(3);
  t.same(hostnames.asArray(), []);

  hostnames.add("aikido.dev", 443);
  t.same(hostnames.asArray(), [{ hostname: "aikido.dev", port: 443, hits: 1 }]);

  hostnames.add("aikido.dev", 80);
  t.same(hostnames.asArray(), [
    { hostname: "aikido.dev", port: 443, hits: 1 },
    { hostname: "aikido.dev", port: 80, hits: 1 },
  ]);

  hostnames.add("google.com", 80);
  t.same(hostnames.asArray(), [
    { hostname: "aikido.dev", port: 443, hits: 1 },
    { hostname: "aikido.dev", port: 80, hits: 1 },
    { hostname: "google.com", port: 80, hits: 1 },
  ]);

  hostnames.add("google.com", 0);
  hostnames.add("google.com", -1);
  t.same(hostnames.asArray(), [
    { hostname: "aikido.dev", port: 443, hits: 1 },
    { hostname: "aikido.dev", port: 80, hits: 1 },
    { hostname: "google.com", port: 80, hits: 1 },
  ]);

  hostnames.add("github.com", 80);
  t.same(hostnames.asArray(), [
    { hostname: "aikido.dev", port: 80, hits: 1 },
    { hostname: "google.com", port: 80, hits: 1 },
    { hostname: "github.com", port: 80, hits: 1 },
  ]);

  hostnames.add("jetbrains.com", 80);
  t.same(hostnames.asArray(), [
    { hostname: "google.com", port: 80, hits: 1 },
    { hostname: "github.com", port: 80, hits: 1 },
    { hostname: "jetbrains.com", port: 80, hits: 1 },
  ]);

  hostnames.clear();
  t.same(hostnames.asArray(), []);
});

t.test("it respects max size", async () => {
  const hostnames = new Hostnames(2);
  hostnames.add("aikido.dev", 1);
  hostnames.add("aikido.dev", 2);

  t.same(hostnames.asArray(), [
    { hostname: "aikido.dev", port: 1, hits: 1 },
    { hostname: "aikido.dev", port: 2, hits: 1 },
  ]);

  hostnames.add("aikido.dev", 3);
  hostnames.add("aikido.dev", 4);

  t.same(hostnames.asArray(), [
    { hostname: "aikido.dev", port: 3, hits: 1 },
    { hostname: "aikido.dev", port: 4, hits: 1 },
  ]);

  hostnames.add("google.com", 1);

  t.same(hostnames.asArray(), [
    { hostname: "aikido.dev", port: 4, hits: 1 },
    { hostname: "google.com", port: 1, hits: 1 },
  ]);

  hostnames.add("google.com", 2);

  t.same(hostnames.asArray(), [
    { hostname: "google.com", port: 1, hits: 1 },
    { hostname: "google.com", port: 2, hits: 1 },
  ]);
});

t.test("it tracks hits", async () => {
  const hostnames = new Hostnames(3);

  hostnames.add("aikido.dev", 443);
  hostnames.add("aikido.dev", 443);
  t.same(hostnames.asArray(), [{ hostname: "aikido.dev", port: 443, hits: 2 }]);

  hostnames.add("aikido.dev", 80);
  t.same(hostnames.asArray(), [
    { hostname: "aikido.dev", port: 443, hits: 2 },
    { hostname: "aikido.dev", port: 80, hits: 1 },
  ]);

  hostnames.add("google.com", 80);
  t.same(hostnames.asArray(), [
    { hostname: "aikido.dev", port: 443, hits: 2 },
    { hostname: "aikido.dev", port: 80, hits: 1 },
    { hostname: "google.com", port: 80, hits: 1 },
  ]);

  hostnames.add("aikido.dev", 443);
  t.same(hostnames.asArray(), [
    { hostname: "aikido.dev", port: 443, hits: 3 },
    { hostname: "aikido.dev", port: 80, hits: 1 },
    { hostname: "google.com", port: 80, hits: 1 },
  ]);
});
