import * as t from "tap";
import { startsWithUnsafePath } from "./unsafePathStart";

t.test("relative paths are ignored", async () => {
  t.same(startsWithUnsafePath("etc/passwd", "etc/passwd"), false);
  t.same(startsWithUnsafePath("/etc/passwd", "etc/passwd"), false);
  t.same(startsWithUnsafePath("etc/passwd", "/etc/passwd"), false);
});

t.test("flags absolute paths in dangerous folders", async () => {
  t.same(startsWithUnsafePath("/etc/passwd", "/etc/passwd"), true);
  t.same(startsWithUnsafePath("/etc/passwd", "/etc/pass"), true);
  t.same(startsWithUnsafePath("/app/config/secret.yml", "/app/conf"), true);
  t.same(startsWithUnsafePath("/ETC/passwd", "/etc/PASSWD"), true);
});

t.test("flags inputs that normalize to a dangerous folder", async () => {
  t.same(startsWithUnsafePath("/etc/passwd", "/./etc"), true);
  t.same(startsWithUnsafePath("/root/test.txt", "///.///root"), true);
});

t.test("does not flag the dangerous folder itself", async () => {
  t.same(startsWithUnsafePath("/etc/passwd", "/etc/"), false);
  t.same(startsWithUnsafePath("/etc/passwd", "/etc"), false);
});

t.test("does not flag a prefix of a dangerous folder name", async () => {
  t.same(
    startsWithUnsafePath("/app/node_modules/pkg/package.json", "/a"),
    false
  );
  t.same(
    startsWithUnsafePath("/app/node_modules/pkg/package.json", "/ap"),
    false
  );
  t.same(startsWithUnsafePath("/etc/passwd", "/et"), false);
});

t.test("does not flag input that is not a prefix of the path", async () => {
  t.same(startsWithUnsafePath("/etc/passwd", "/etc/shadow"), false);
  t.same(startsWithUnsafePath("/srv/data/file.txt", "/other/file.txt"), false);
});
