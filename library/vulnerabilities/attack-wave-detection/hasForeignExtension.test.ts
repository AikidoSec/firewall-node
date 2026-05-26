import * as t from "tap";
import { hasForeignExtension } from "./hasForeignExtension";

t.test("has foreign extension", async (t) => {
  t.ok(hasForeignExtension("/admin.php"));
  t.ok(hasForeignExtension("/login.php3"));
  t.ok(hasForeignExtension("/test.php4"));
  t.ok(hasForeignExtension("/old.php5"));
  t.ok(hasForeignExtension("/page.phtml"));
  t.ok(hasForeignExtension("/App.java"));
  t.ok(hasForeignExtension("/app.jsp"));
  t.ok(hasForeignExtension("/app.jspx"));
  t.ok(hasForeignExtension("/nested/path/admin.php"));
  t.ok(hasForeignExtension("/ADMIN.PHP"));
});

t.test("does not have foreign extension", async (t) => {
  t.notOk(hasForeignExtension("/app.js"));
  t.notOk(hasForeignExtension("/style.css"));
  t.notOk(hasForeignExtension("/index.html"));
  t.notOk(hasForeignExtension("/api/users"));
  t.notOk(hasForeignExtension("/"));
  t.notOk(hasForeignExtension("/no-extension"));
});
