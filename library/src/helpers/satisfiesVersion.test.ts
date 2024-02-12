import * as t from "tap";
import { satisfiesVersion } from "./satisfiesVersion";

t.test("it returns false if empty strings", async () => {
  t.equal(satisfiesVersion("", ""), false);
});

t.test("it returns false if empty range", async () => {
  t.equal(satisfiesVersion("", "1.0.0"), false);
});

t.test("it returns false if empty version", async () => {
  t.equal(satisfiesVersion("^1.0.0", ""), false);
});

t.test("it returns false if invalid version", async () => {
  t.equal(satisfiesVersion("^1.0.0", "1.0"), false);
});

t.test("it returns false if invalid range", async () => {
  t.equal(satisfiesVersion("1.0.0", "1.0.0"), false);
});

t.test("it matches single range", async () => {
  t.equal(satisfiesVersion("^1.0.0", "1.0.0"), true);
  t.equal(satisfiesVersion("^1.0.0", "1.1.0"), true);
  t.equal(satisfiesVersion("^1.0.0", "1.1.1"), true);
  t.equal(satisfiesVersion("^1.0.0", "1.1.10"), true);
  t.equal(satisfiesVersion("^1.2.0", "1.1.10"), false);
  t.equal(satisfiesVersion("^1.2.0", "1.2.0"), true);
  t.equal(satisfiesVersion("^1.2.0", "1.2.1"), true);
  t.equal(satisfiesVersion("^1.0.0", "0.0.0"), false);
  t.equal(satisfiesVersion("^1.0.0", "2.0.0"), false);
  t.equal(satisfiesVersion("^2.0.0", "1.0.0"), false);
});

t.test("it matches multiple ranges", async () => {
  t.equal(satisfiesVersion("^1.0.0 || ^2.0.0", "1.0.0"), true);
  t.equal(satisfiesVersion("^1.0.0 || ^2.0.0", "2.0.0"), true);
  t.equal(satisfiesVersion("^1.0.0 || ^2.0.0", "2.0.1"), true);
  t.equal(satisfiesVersion("^1.0.0 || ^2.0.0", "3.0.0"), false);
  t.equal(satisfiesVersion("^1.0.0 || ^2.0.0", "0.0.0"), false);
});

t.test("it matches multiple ranges with OR", async () => {
  t.equal(satisfiesVersion("^1.0.0 || ^2.0.0 || ^3.0.0", "1.0.0"), true);
  t.equal(satisfiesVersion("^1.0.0 || ^2.0.0 || ^3.0.0", "2.0.0"), true);
  t.equal(satisfiesVersion("^1.0.0 || ^2.0.0 || ^3.0.0", "3.0.0"), true);
  t.equal(satisfiesVersion("^1.0.0 || ^2.0.0 || ^3.0.0", "3.0.1"), true);
  t.equal(satisfiesVersion("^1.0.0 || ^2.0.0 || ^3.0.0", "4.0.0"), false);
  t.equal(satisfiesVersion("^1.0.0 || ^2.0.0 || ^3.0.0", "0.0.0"), false);
});
