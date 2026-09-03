import * as t from "tap";
import { toXmlString } from "./toXmlString";

t.test("returns the string as-is", async () => {
  t.same(toXmlString("<root>hello</root>"), "<root>hello</root>");
});

t.test("decodes a Buffer to a string", async () => {
  t.same(toXmlString(Buffer.from("<root>hello</root>")), "<root>hello</root>");
});

t.test("returns undefined for other types", async () => {
  t.same(toXmlString(123), undefined);
  t.same(toXmlString({}), undefined);
  t.same(toXmlString(null), undefined);
  t.same(toXmlString(undefined), undefined);
});
