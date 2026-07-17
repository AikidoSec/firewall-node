import t from "tap";
import { isWebScanPath } from "./isWebScanPath";
import { fileNames } from "./paths/fileNames";
import { directoryNames } from "./paths/directoryNames";

t.test("isWebScanPath", async (t) => {
  t.ok(isWebScanPath("/.env", 404));
  t.ok(isWebScanPath("/test/.env", 404));
  t.ok(isWebScanPath("/test/.env.bak", 404));
  t.ok(isWebScanPath("/.git/config", 404));
  t.ok(isWebScanPath("/.aws/config", 404));
  t.ok(isWebScanPath("/some/path/.git/test", 404));
  t.ok(isWebScanPath("/some/path/.gitlab-ci.yml", 404));
  t.ok(isWebScanPath("/some/path/.github/workflows/test.yml", 404));
  t.ok(isWebScanPath("/.travis.yml", 404));
  t.ok(isWebScanPath("/../example/", 404));
  t.ok(isWebScanPath("/./test", 404));
  t.ok(isWebScanPath("/Cargo.lock", 404));
  t.ok(isWebScanPath("/System32/test", 404));
});

t.test("is not a web scan path", async (t) => {
  t.notOk(isWebScanPath("/test/file.txt", 404));
  t.notOk(isWebScanPath("/some/route/to/file.txt", 404));
  t.notOk(isWebScanPath("/some/route/to/file.json", 404));
  t.notOk(isWebScanPath("/en", 404));
  t.notOk(isWebScanPath("/", 404));
  t.notOk(isWebScanPath("/test/route", 404));
  t.notOk(isWebScanPath("/static/file.css", 404));
  t.notOk(isWebScanPath("/static/file.a461f56e.js", 404));
});

t.test("foreign extension with 404 is a scan path", async (t) => {
  t.ok(isWebScanPath("/admin.php", 404));
  t.ok(isWebScanPath("/login.php3", 404));
  t.ok(isWebScanPath("/test.php4", 404));
  t.ok(isWebScanPath("/old.php5", 404));
  t.ok(isWebScanPath("/page.phtml", 404));
  t.ok(isWebScanPath("/App.java", 404));
  t.ok(isWebScanPath("/app.jsp", 404));
  t.ok(isWebScanPath("/app.jspx", 404));
  t.ok(isWebScanPath("/nested/path/admin.php", 404));
  t.ok(isWebScanPath("/ADMIN.PHP", 404));
});

t.test("foreign extension with 200 is not a scan path", async (t) => {
  t.notOk(isWebScanPath("/admin.php", 200));
  t.notOk(isWebScanPath("/login.php3", 200));
  t.notOk(isWebScanPath("/app.jsp", 200));
  t.notOk(isWebScanPath("/App.java", 200));
});

t.test(
  "foreign extension with other status codes is not a scan path",
  async (t) => {
    t.notOk(isWebScanPath("/admin.php", 301));
    t.notOk(isWebScanPath("/admin.php", 403));
    t.notOk(isWebScanPath("/admin.php", 500));
  }
);

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
