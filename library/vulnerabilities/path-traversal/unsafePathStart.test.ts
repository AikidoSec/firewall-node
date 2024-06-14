import * as t from "tap";
import { isRelativePath } from "./unsafePathStart";

t.test("is relative path", async () => {
  t.same(isRelativePath("../test"), true);
  t.same(isRelativePath("test"), true);
  t.same(isRelativePath("../../test"), true);
  t.same(isRelativePath("test/folder"), true);
  t.same(isRelativePath("./test"), true);
});

t.test("is not relative path", async () => {
  t.same(isRelativePath("/test"), false);
  t.same(isRelativePath("c:/test"), false);
  t.same(isRelativePath("c:\\test"), false);
  t.same(isRelativePath("C:/test/folder"), false);
  t.same(isRelativePath("c:\\test\\folder"), false);
  t.same(isRelativePath("D:\\test"), false);
  t.same(isRelativePath("/./test"), false);
  t.same(isRelativePath("/../test"), false);
  t.same(isRelativePath("/test/folder"), false);
  t.same(isRelativePath("//test"), false);
});
