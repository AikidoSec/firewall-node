import * as t from "tap";
import { getRawUrlPath } from "./getRawUrlPath";

t.test("it returns the raw URL path", async (t) => {
  t.equal(getRawUrlPath(""), "/");
  t.equal(getRawUrlPath("/"), "/");
  t.equal(getRawUrlPath("/?test=abc"), "/");
  t.equal(getRawUrlPath("#"), "/");
  t.equal(getRawUrlPath("https://example.com"), "/");

  t.equal(
    getRawUrlPath("https://example.com/path/to/resource"),
    "/path/to/resource"
  );
  t.equal(
    getRawUrlPath("http://example.com/path/to/resource/"),
    "/path/to/resource/"
  );
  t.equal(
    getRawUrlPath("https://example.com/path/to/resource/123"),
    "/path/to/resource/123"
  );
  t.equal(
    getRawUrlPath("https://example.com/path/to/resource/123/456"),
    "/path/to/resource/123/456"
  );
  t.equal(
    getRawUrlPath("https://example.com/path/to/resource/123/456/789"),
    "/path/to/resource/123/456/789"
  );
  t.equal(
    getRawUrlPath(
      "https://example.com/path/to/resource/123/456/789?query=string"
    ),
    "/path/to/resource/123/456/789"
  );
  t.equal(
    getRawUrlPath("https://example.com/path/to/resource/123/456/789#fragment"),
    "/path/to/resource/123/456/789"
  );
  t.equal(
    getRawUrlPath(
      "https://example.com/path/to/resource/123/456/789?query=string#fragment"
    ),
    "/path/to/resource/123/456/789"
  );
});
