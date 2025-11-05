import * as t from "tap";
import { getBodyDataType } from "./getBodyDataType";

t.test("it works", async (t) => {
  t.same(getBodyDataType({ "content-type": "application/json" }), "json");
  t.same(
    getBodyDataType({ "content-type": "application/vnd.api+json" }),
    "json"
  );
  t.same(getBodyDataType({ "content-type": "application/csp-report" }), "json");
  t.same(getBodyDataType({ "content-type": "application/x-json" }), "json");
  t.same(
    getBodyDataType({ "content-type": "application/json; charset=utf-8" }),
    "json"
  );
  t.same(getBodyDataType({ "content-type": "Application/JSON" }), "json");
  t.same(getBodyDataType({ "content-type": "application/ld+json" }), "json");
  t.same(getBodyDataType({ "content-type": " application/json " }), "json");
  t.same(
    getBodyDataType({ "content-type": "application/x-www-form-urlencoded" }),
    "form-urlencoded"
  );
  t.same(
    getBodyDataType({ "content-type": "multipart/form-data" }),
    "form-data"
  );
  t.same(getBodyDataType({ "content-type": "text/xml" }), "xml");
  t.same(getBodyDataType({ "content-type": "application/xml" }), "xml");
  t.same(getBodyDataType({ "content-type": "application/atom+xml" }), "xml");
  t.same(getBodyDataType({ "content-type": "text/html" }), undefined);
  t.same(
    getBodyDataType({ "content-type": ["application/json", "text/html"] }),
    "json"
  );
  t.same(getBodyDataType({ "x-test": "abc" }), undefined);
  // @ts-expect-error Testing invalid input
  t.same(getBodyDataType(null), undefined);
  t.same(getBodyDataType({}), undefined);
});
