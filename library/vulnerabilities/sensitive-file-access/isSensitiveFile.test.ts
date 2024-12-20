import * as t from "tap";
import { isSensitiveFile } from "./isSensitiveFile";

t.test("is a sensitive file", async (t) => {
  t.same(isSensitiveFile("/.env"), true);
  t.same(isSensitiveFile("/.ENV"), true);
  t.same(isSensitiveFile("/.bashrc"), true);
  t.same(isSensitiveFile("/.git"), true);
  t.same(isSensitiveFile("/.git/"), true);
  t.same(isSensitiveFile("/.git/test"), true);
});

t.test("is not a sensitive file", async (t) => {
  t.same(isSensitiveFile("/test"), false);
  t.same(isSensitiveFile("/.env/"), false);
  t.same(isSensitiveFile("/.env/test"), false);
  t.same(isSensitiveFile("/"), false);
  t.same(isSensitiveFile("/.gitabc"), false);
  t.same(isSensitiveFile("/.gitabc/test"), false);
});
