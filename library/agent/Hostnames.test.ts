import * as t from "tap";
import { Hostnames } from "./Hostnames";

t.test("it works", async () => {
  const hostnames = new Hostnames(3);
  t.same(hostnames.asArray(), []);

  hostnames.add("aikido.dev", 443);
  t.same(hostnames.asArray(), [{ hostname: "aikido.dev", port: 443 }]);

  hostnames.add("aikido.dev", 80);
  t.same(hostnames.asArray(), [
    { hostname: "aikido.dev", port: 443 },
    { hostname: "aikido.dev", port: 80 },
  ]);

  hostnames.add("google.com", 80);
  t.same(hostnames.asArray(), [
    { hostname: "aikido.dev", port: 443 },
    { hostname: "aikido.dev", port: 80 },
    { hostname: "google.com", port: 80 },
  ]);

  hostnames.add("google.com", undefined);
  t.same(hostnames.asArray(), [
    { hostname: "aikido.dev", port: 80 },
    { hostname: "google.com", port: 80 },
    { hostname: "google.com", port: undefined },
  ]);

  hostnames.add("github.com", 80);
  t.same(hostnames.asArray(), [
    { hostname: "google.com", port: 80 },
    { hostname: "google.com", port: undefined },
    { hostname: "github.com", port: 80 },
  ]);

  hostnames.add("jetbrains.com", 80);
  t.same(hostnames.asArray(), [
    { hostname: "google.com", port: undefined },
    { hostname: "github.com", port: 80 },
    { hostname: "jetbrains.com", port: 80 },
  ]);

  hostnames.clear();
  t.same(hostnames.asArray(), []);
});
