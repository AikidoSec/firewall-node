import * as t from "tap";
import { isWebScanPath } from "./isWebScanPath";
import { fileNames } from "./paths/fileNames";
import { directoryNames } from "./paths/directoryNames";

t.test("isWebScanPath", async (t) => {
  t.ok(isWebScanPath("/.env"));
  t.ok(isWebScanPath("/test/.env"));
  t.ok(isWebScanPath("/test/.env.bak"));
  t.ok(isWebScanPath("/.git/config"));
  t.ok(isWebScanPath("/.aws/config"));
  t.ok(isWebScanPath("/some/path/.git/test"));
  t.ok(isWebScanPath("/some/path/.gitlab-ci.yml"));
  t.ok(isWebScanPath("/some/path/.github/workflows/test.yml"));
  t.ok(isWebScanPath("/.travis.yml"));
  t.ok(isWebScanPath("/../example/"));
  t.ok(isWebScanPath("/./test"));
});

t.test("is not a web scan path", async (t) => {
  t.notOk(isWebScanPath("/test/file.txt"));
  t.notOk(isWebScanPath("/some/route/to/file.txt"));
  t.notOk(isWebScanPath("/some/route/to/file.json"));
  t.notOk(isWebScanPath("/en"));
  t.notOk(isWebScanPath("/"));
  t.notOk(isWebScanPath("/test/route"));
  t.notOk(isWebScanPath("/static/file.css"));
  t.notOk(isWebScanPath("/static/file.a461f56e.js"));
});

t.test("Not duplicates in fileNames", async (t) => {
  const uniqueFileNames = new Set(fileNames);
  t.equal(
    uniqueFileNames.size,
    fileNames.length,
    "File names should be unique"
  );
});

t.test("No duplicate in directoryNames", async (t) => {
  const uniqueDirectoryNames = new Set(directoryNames);
  t.equal(
    uniqueDirectoryNames.size,
    directoryNames.length,
    "Directory names should be unique"
  );
});
