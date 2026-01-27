import * as t from "tap";
import * as FakeTimers from "@sinonjs/fake-timers";
import { Packages } from "./Packages";

t.test("addPackage should add a new package", async (t) => {
  const clock = FakeTimers.install();
  const packages = new Packages();
  packages.addPackage({ name: "express", version: "4.17.1" });
  const arr = packages.asArray();
  t.same(arr, [{ name: "express", version: "4.17.1", requiredAt: 0 }]);
  clock.uninstall();
});

t.test(
  "addPackage should add a new version for an existing package",
  async (t) => {
    const clock = FakeTimers.install();
    const packages = new Packages();
    packages.addPackage({ name: "lodash", version: "4.17.20" });
    clock.tick(10);
    packages.addPackage({ name: "lodash", version: "4.17.21" });
    const arr = packages.asArray();
    t.same(arr, [
      { name: "lodash", version: "4.17.20", requiredAt: 0 },
      { name: "lodash", version: "4.17.21", requiredAt: 10 },
    ]);
    clock.uninstall();
  }
);

t.test("addPackage should not add a duplicate package version", async (t) => {
  const clock = FakeTimers.install();
  const packages = new Packages();
  packages.addPackage({ name: "moment", version: "2.29.1" });
  packages.addPackage({ name: "moment", version: "2.29.1" });
  const arr = packages.asArray();
  t.same(arr, [{ name: "moment", version: "2.29.1", requiredAt: 0 }]);
  clock.uninstall();
});

t.test(
  "asArray should return an empty array when no packages are added",
  async (t) => {
    const packages = new Packages();
    const arr = packages.asArray();
    t.same(arr, [], "should return an empty array");
  }
);

t.test("asArray should return all packages and versions", async (t) => {
  const clock = FakeTimers.install();
  const packages = new Packages();
  packages.addPackage({ name: "express", version: "4.17.1" });
  clock.tick(5);
  packages.addPackage({ name: "lodash", version: "4.17.20" });
  clock.tick(15);
  packages.addPackage({ name: "lodash", version: "4.17.21" });
  const arr = packages.asArray();
  t.same(arr, [
    { name: "express", version: "4.17.1", requiredAt: 0 },
    { name: "lodash", version: "4.17.20", requiredAt: 5 },
    { name: "lodash", version: "4.17.21", requiredAt: 20 },
  ]);
  clock.uninstall();
});

t.test("clear should remove all packages", async (t) => {
  const clock = FakeTimers.install();
  const packages = new Packages();
  packages.addPackage({ name: "express", version: "4.17.1" });
  packages.addPackage({ name: "lodash", version: "4.17.20" });
  packages.clear();
  const arr = packages.asArray();
  t.same(arr, [], "should return an empty array after clear");
  clock.uninstall();
});

t.test(
  "addPackage should reject new package if max size is reached",
  async (t) => {
    const clock = FakeTimers.install();
    const maxSize = 2;
    const packages = new Packages(maxSize);

    packages.addPackage({ name: "express", version: "4.17.1" });
    packages.addPackage({ name: "lodash", version: "4.17.20" });
    packages.addPackage({ name: "moment", version: "2.29.1" }); // should fail

    const arr = packages.asArray();
    t.same(
      arr,
      [
        { name: "express", version: "4.17.1", requiredAt: 0 },
        { name: "lodash", version: "4.17.20", requiredAt: 0 },
      ],
      "should not add new package if max size is reached"
    );
    clock.uninstall();
  }
);
