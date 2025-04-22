import * as t from "tap";
import {
  containsUnsafePathParts,
  containsUnsafePathPartsUrl,
} from "./containsUnsafePathParts";
import { fileURLToPath } from "url";

t.test("not a dangerous path", async () => {
  t.same(containsUnsafePathParts("test.txt"), false);
  t.same(containsUnsafePathParts("/var/www/test.txt"), false);
  t.same(containsUnsafePathParts("./test.txt"), false);
  t.same(containsUnsafePathParts("test.txt/"), false);
});

t.test("it detects dangerous path parts", async () => {
  t.same(containsUnsafePathParts("../test.txt"), true);
  t.same(containsUnsafePathParts("..\\test.txt"), true);
  t.same(containsUnsafePathParts("../../test.txt"), true);
  t.same(containsUnsafePathParts("..\\..\\test.txt"), true);
  t.same(containsUnsafePathParts("../../../../test.txt"), true);
  t.same(containsUnsafePathParts("..\\..\\..\\..\\test.txt"), true);
  t.same(containsUnsafePathParts("/test/../test.txt"), true);
  t.same(containsUnsafePathParts("/test/..\\test.txt"), true);
});

t.test(
  "containsUnsafePathParts does not detect with control characters",
  async () => {
    t.same(containsUnsafePathParts("file:///.\t./test.txt"), false);
    t.same(containsUnsafePathParts("file:///.\n./test.txt"), false);
    t.same(containsUnsafePathParts("file:///.\r./test.txt"), false);
  }
);

t.test("it detects dangerous path parts for URLs", async () => {
  t.same(containsUnsafePathPartsUrl("/../test.txt"), true);
  t.same(containsUnsafePathPartsUrl("/..\\test.txt"), true);
  t.same(containsUnsafePathPartsUrl("file:///../test.txt"), true);
  t.same(containsUnsafePathPartsUrl("file://..\\test.txt"), true);
  t.same(containsUnsafePathPartsUrl("file:///.\t./test.txt"), true);
  t.same(containsUnsafePathPartsUrl("file://.\n./test.txt"), true);
  t.same(containsUnsafePathPartsUrl("file://.\r./test.txt"), true);
  t.same(containsUnsafePathPartsUrl("file:///.\t\t./test.txt"), true);
  t.same(containsUnsafePathPartsUrl("file:///.\t\n./test.txt"), true);
});

t.test("it only removes some chars from the URL", async () => {
  t.same(fileURLToPath("file:///.\t./test.txt"), "/test.txt");
  t.same(fileURLToPath("file:///.\n./test.txt"), "/test.txt");
  t.same(fileURLToPath("file:///.\r./test.txt"), "/test.txt");
  t.same(fileURLToPath("file:///.\0./test.txt"), "/.\0./test.txt");
  t.same(fileURLToPath("file:///.\u0000./test.txt"), "/.\u0000./test.txt");
  t.same(fileURLToPath("file:///.\v./test.txt"), "/.\v./test.txt");
  t.same(fileURLToPath("file:///.\f./test.txt"), "/.\f./test.txt");
  t.same(fileURLToPath("file:///.\b./test.txt"), "/.\b./test.txt");
  t.same(fileURLToPath("file:///.\t\t./test.txt"), "/test.txt");
  t.same(fileURLToPath("file:///.\t\n./test.txt"), "/test.txt");
});
