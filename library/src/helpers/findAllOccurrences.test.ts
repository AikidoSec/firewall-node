import * as t from "tap";
import { findAllOccurrences } from "./findAllOccurrences";

t.test("it finds all occurrences", async (t) => {
  t.same(findAllOccurrences("a", "a"), [[0, 0]]);
  t.same(findAllOccurrences("a", "b"), []);
  t.same(findAllOccurrences("a", "ab"), []);
  t.same(findAllOccurrences("a", "ba"), []);
  t.same(findAllOccurrences("ab", "a"), [[0, 0]]);
  t.same(findAllOccurrences("ab", "b"), [[1, 1]]);
  t.same(findAllOccurrences("", ""), []);
  t.same(findAllOccurrences("aaa", "a"), [
    [0, 0],
    [1, 1],
    [2, 2],
  ]);
  t.same(findAllOccurrences("ababab", "a"), [
    [0, 0],
    [2, 2],
    [4, 4],
  ]);
  t.same(findAllOccurrences("ababab", "ab"), [
    [0, 1],
    [2, 3],
    [4, 5],
  ]);
});
