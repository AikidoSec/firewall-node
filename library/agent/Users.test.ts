import * as FakeTimers from "@sinonjs/fake-timers";
import * as t from "tap";
import { Users } from "./Users";

t.test("it works", async () => {
  const clock = FakeTimers.install();

  const users = new Users(2);
  t.same(users.asArray(), []);

  users.addUser({
    id: "1",
    name: "John",
    rateLimitGroup: undefined,
    lastIpAddress: "::1",
  });
  t.same(users.asArray(), [
    {
      id: "1",
      name: "John",
      rateLimitGroup: undefined,
      lastIpAddress: "::1",
      firstSeenAt: 0,
      lastSeenAt: 0,
    },
  ]);

  clock.tick(1);

  users.addUser({
    id: "1",
    name: "John Doe",
    rateLimitGroup: "group",
    lastIpAddress: "1.2.3.4",
  });
  t.same(users.asArray(), [
    {
      id: "1",
      name: "John Doe",
      rateLimitGroup: "group",
      lastIpAddress: "1.2.3.4",
      firstSeenAt: 0,
      lastSeenAt: 1,
    },
  ]);

  users.addUser({
    id: "2",
    name: "Jane",
    rateLimitGroup: "group",
    lastIpAddress: "1.2.3.4",
  });
  t.same(users.asArray(), [
    {
      id: "1",
      name: "John Doe",
      rateLimitGroup: "group",
      lastIpAddress: "1.2.3.4",
      firstSeenAt: 0,
      lastSeenAt: 1,
    },
    {
      id: "2",
      name: "Jane",
      rateLimitGroup: "group",
      lastIpAddress: "1.2.3.4",
      firstSeenAt: 1,
      lastSeenAt: 1,
    },
  ]);

  users.addUser({
    id: "3",
    name: "Alice",
    rateLimitGroup: undefined,
    lastIpAddress: "1.2.3.4",
  });
  t.same(users.asArray(), [
    {
      id: "2",
      name: "Jane",
      rateLimitGroup: "group",
      lastIpAddress: "1.2.3.4",
      firstSeenAt: 1,
      lastSeenAt: 1,
    },
    {
      id: "3",
      name: "Alice",
      rateLimitGroup: undefined,
      lastIpAddress: "1.2.3.4",
      firstSeenAt: 1,
      lastSeenAt: 1,
    },
  ]);

  users.clear();

  t.same(users.asArray(), []);

  clock.uninstall();
});
