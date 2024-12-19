import * as t from "tap";
import { LRUMap } from "./LRUMap";

t.test("it creates LRUMap", async (t) => {
  const map = new LRUMap<number, string>(5, 1000);
  t.equal(map.size, 0, "Size should be 0 initially");
});

t.test("it throws error when constructor args are invalid", async () => {
  t.throws(() => new LRUMap(-1), "Invalid max value");
  t.throws(() => new LRUMap(100, -1), "Invalid ttl value");
});

t.test("LRUMap set and get methods", async (t) => {
  const map = new LRUMap<string, string>();

  map.set("key1", "value1");
  t.equal(map.get("key1"), "value1", "Value should be retrieved correctly");

  map.set("key2", "value2");
  t.equal(map.get("key2"), "value2", "Value should be retrieved correctly");

  t.equal(map.size, 2, "Size should be 2 after adding two items");
});

t.test("LRUMap eviction policy", async (t) => {
  const map = new LRUMap<number, string>(2);

  map.set(1, "value1");
  map.set(2, "value2");
  t.equal(map.size, 2, "Size should be 2 after adding two items");

  map.set(3, "value3");
  t.equal(map.size, 2, "Size should be 2 after adding third item");
  t.equal(map.get(1), undefined, "First item should be evicted");
  t.equal(map.get(2), "value2", "Second item should still be present");
  t.equal(map.get(3), "value3", "Third item should be present");
});

t.test("LRUMap TTL expiration", async (t) => {
  const map = new LRUMap<string, string>(5, 100);

  map.set("key1", "value1");
  t.equal(map.get("key1"), "value1", "Value should be retrieved correctly");

  // Wait for TTL to expire
  await new Promise((resolve) => setTimeout(resolve, 150));

  t.equal(
    map.get("key1"),
    undefined,
    "Value should be undefined after TTL expiration"
  );
  t.equal(map.size, 0, "Size should be 0 after TTL expiration");
});

t.test("LRUMap clear method", async (t) => {
  const map = new LRUMap<string, string>();

  map.set("key1", "value1");
  map.set("key2", "value2");
  t.equal(map.size, 2, "Size should be 2 after adding two items");

  map.clear();
  t.equal(map.size, 0, "Size should be 0 after clearing");
  t.equal(
    map.get("key1"),
    undefined,
    "Value should be undefined after clearing"
  );
  t.equal(
    map.get("key2"),
    undefined,
    "Value should be undefined after clearing"
  );
});

t.test("LRUMap delete method", async (t) => {
  const map = new LRUMap<string, string>();

  map.set("key1", "value1");
  map.set("key2", "value2");
  t.equal(map.size, 2, "Size should be 2 after adding two items");

  map.delete("key1");
  t.equal(map.size, 1, "Size should be 1 after deleting one item");
  t.equal(
    map.get("key1"),
    undefined,
    "Value should be undefined after deletion"
  );
  t.equal(
    map.get("key2"),
    "value2",
    "Value should be retrieved correctly for remaining item"
  );
});

t.test("LRUMap keys method", async (t) => {
  const map = new LRUMap<string, string>();

  map.set("key1", "value1");
  map.set("key2", "value2");
  map.set("key3", "value3");

  const keys = Array.from(map.keys());
  t.same(keys, ["key1", "key2", "key3"], "Keys should be retrieved correctly");
});
