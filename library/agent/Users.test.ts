import * as t from "tap";
import { Users } from "./Users";

/**
 * t.test("it works", async () => {
 *   const hostnames = new Hostnames(3);
 *   t.same(hostnames.asArray(), []);
 *
 *   hostnames.add("aikido.dev", 433);
 *   t.same(hostnames.asArray(), [{ hostname: "aikido.dev", port: 433 }]);
 *
 *   hostnames.add("aikido.dev", 80);
 *   t.same(hostnames.asArray(), [{ hostname: "aikido.dev", port: 433 }]);
 *
 *   hostnames.add("google.com", 80);
 *   t.same(hostnames.asArray(), [
 *     { hostname: "aikido.dev", port: 433 },
 *     { hostname: "google.com", port: 80 },
 *   ]);
 *
 *   hostnames.add("github.com", 80);
 *   t.same(hostnames.asArray(), [
 *     { hostname: "aikido.dev", port: 433 },
 *     { hostname: "google.com", port: 80 },
 *     { hostname: "github.com", port: 80 },
 *   ]);
 *
 *   hostnames.add("jetbrains.com", 80);
 *   t.same(hostnames.asArray(), [
 *     { hostname: "google.com", port: 80 },
 *     { hostname: "github.com", port: 80 },
 *     { hostname: "jetbrains.com", port: 80 },
 *   ]);
 *
 *   hostnames.clear();
 *   t.same(hostnames.asArray(), []);
 * });
 */

t.test("it works", async () => {
  const users = new Users(2);
  t.same(users.asArray(), []);

  users.addUser({ id: "1", name: "John", lastIpAddress: "::1" });
  t.same(users.asArray(), [{ id: "1", name: "John", lastIpAddress: "::1" }]);

  users.addUser({ id: "1", name: "John Doe", lastIpAddress: "1.2.3.4" });
  t.same(users.asArray(), [
    { id: "1", name: "John Doe", lastIpAddress: "1.2.3.4" },
  ]);

  users.addUser({ id: "2", name: "Jane", lastIpAddress: "1.2.3.4" });
  t.same(users.asArray(), [
    { id: "1", name: "John Doe", lastIpAddress: "1.2.3.4" },
    {
      id: "2",
      name: "Jane",
      lastIpAddress: "1.2.3.4",
    },
  ]);

  users.addUser({ id: "3", name: "Alice", lastIpAddress: "1.2.3.4" });
  t.same(users.asArray(), [
    {
      id: "2",
      name: "Jane",
      lastIpAddress: "1.2.3.4",
    },
    {
      id: "3",
      name: "Alice",
      lastIpAddress: "1.2.3.4",
    },
  ]);

  users.clear();

  t.same(users.asArray(), []);
});
