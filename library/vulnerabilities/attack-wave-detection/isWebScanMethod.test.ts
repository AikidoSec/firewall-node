import * as t from "tap";
import { isWebScanMethod } from "./isWebScanMethod";

t.test("isWebScanMethod", async (t) => {
  t.ok(isWebScanMethod("BADMETHOD"));
  t.ok(isWebScanMethod("BADHTTPMETHOD"));
  t.ok(isWebScanMethod("BADDATA"));
  t.ok(isWebScanMethod("BADMTHD"));
  t.ok(isWebScanMethod("BDMTHD"));
});

t.test("is not a web scan method", async (t) => {
  t.notOk(isWebScanMethod("GET"));
  t.notOk(isWebScanMethod("POST"));
  t.notOk(isWebScanMethod("PUT"));
  t.notOk(isWebScanMethod("DELETE"));
  t.notOk(isWebScanMethod("PATCH"));
  t.notOk(isWebScanMethod("OPTIONS"));
  t.notOk(isWebScanMethod("HEAD"));
  t.notOk(isWebScanMethod("TRACE"));
  t.notOk(isWebScanMethod("CONNECT"));
  t.notOk(isWebScanMethod("PURGE"));
});
