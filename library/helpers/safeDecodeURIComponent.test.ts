import * as t from "tap";
import { safeDecodeURIComponent } from "./safeDecodeURIComponent";

t.test("it decodes a URI component", async (t) => {
  t.equal(safeDecodeURIComponent("%20"), " ");
  t.equal(safeDecodeURIComponent("%3A"), ":");
  t.equal(safeDecodeURIComponent("%2F"), "/");
  t.equal(safeDecodeURIComponent("test%20test"), "test test");
  t.equal(safeDecodeURIComponent("test%3Atest"), "test:test");
});

t.test("it returns undefined for invalid URI components", async (t) => {
  t.equal(safeDecodeURIComponent("%"), undefined);
  t.equal(safeDecodeURIComponent("%2"), undefined);
  t.equal(safeDecodeURIComponent("%2G"), undefined);
  t.equal(safeDecodeURIComponent("%2g"), undefined);
  t.equal(safeDecodeURIComponent("test%gtest"), undefined);
  t.equal(safeDecodeURIComponent("test%test"), undefined);
});
