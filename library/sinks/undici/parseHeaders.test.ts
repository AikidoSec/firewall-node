import * as t from "tap";
import { parseHeaders } from "./parseHeaders";

t.test("it works", async (t) => {
  t.same(
    parseHeaders([
      Buffer.from("content-type"),
      Buffer.from("application/json"),
    ]),
    { "content-type": "application/json" }
  );
  t.same(
    parseHeaders([
      Buffer.from("content-type"),
      Buffer.from("application/json"),
      Buffer.from("content-type"),
      Buffer.from("application/xml"),
    ]),
    { "content-type": ["application/json", "application/xml"] }
  );
  t.same(
    parseHeaders([
      "content-type",
      Buffer.from("application/json"),
      "x-foo",
      "a",
    ]),
    { "content-type": "application/json", "x-foo": "a" }
  );

  t.same(
    parseHeaders([
      "content-type",
      Buffer.from("application/json"),
      "content-disposition",
      Buffer.from('attachment; filename="test.txt"'),
    ]),
    {
      "content-type": "application/json",
      "content-disposition": 'attachment; filename="test.txt"',
    }
  );

  t.same(parseHeaders([], {}), {});

  t.same(
    parseHeaders([
      "content-length",
      [Buffer.from("123"), Buffer.from("456")],
      "content-disposition",
      Buffer.from('attachment; filename="test.txt"'),
    ]),
    {
      "content-length": ["123", "456"],
      "content-disposition": 'attachment; filename="test.txt"',
    }
  );
});
