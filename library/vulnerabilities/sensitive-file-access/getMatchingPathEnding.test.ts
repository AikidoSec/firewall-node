import * as t from "tap";
import { getMatchingPathEnding as get } from "./getMatchingPathEnding";

t.test("it works", async (t) => {
  t.same(get("/a/b/c", "/a/b/c"), "/a/b/c");
  t.same(get("/a/b", "/a/b/c"), undefined);
  t.same(get("/a/b/c", "/b/c"), "/b/c");

  t.same(
    get("/static/test/file.txt", "/static/test/file.txt"),
    "/static/test/file.txt"
  );
  t.same(
    get("/static/test/file.txt", "/opt/app/data/static/test/file.txt"),
    "/static/test/file.txt"
  );
  t.same(
    get("/static/test/file.txt", "/opt/app/data/test/file.txt"),
    "/test/file.txt"
  );
  t.same(get("/static/test/file.txt", "/file.txt"), "/file.txt");
  t.same(get("/static/test/file.txt", "file.txt"), "/file.txt");

  t.same(get("/static/test/file.txt", "abc.txt"), undefined);
  t.same(get("/static/test/file.txt", "file"), undefined);
});
