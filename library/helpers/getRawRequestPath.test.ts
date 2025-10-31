import * as t from "tap";
import { getRawRequestPath } from "./getRawRequestPath";

t.test("it returns the raw URL path", async (t) => {
  t.equal(getRawRequestPath(""), "/");
  t.equal(getRawRequestPath("/"), "/");
  t.equal(getRawRequestPath("/?test=abc"), "/");
  t.equal(getRawRequestPath("#"), "/");
  t.equal(getRawRequestPath("https://example.com"), "/");

  t.equal(
    getRawRequestPath("https://example.com/path/to/resource"),
    "/path/to/resource"
  );
  t.equal(
    getRawRequestPath("http://example.com/path/to/resource/"),
    "/path/to/resource/"
  );
  t.equal(
    getRawRequestPath("https://example.com/path/to/resource/123"),
    "/path/to/resource/123"
  );
  t.equal(
    getRawRequestPath("https://example.com/path/to/resource/123/456"),
    "/path/to/resource/123/456"
  );
  t.equal(
    getRawRequestPath("https://example.com/path/to/resource/123/456/789"),
    "/path/to/resource/123/456/789"
  );
  t.equal(
    getRawRequestPath(
      "https://example.com/path/to/resource/123/456/789?query=string"
    ),
    "/path/to/resource/123/456/789"
  );
  t.equal(
    getRawRequestPath(
      "https://example.com/path/to/resource/123/456/789#fragment"
    ),
    "/path/to/resource/123/456/789"
  );
  t.equal(
    getRawRequestPath(
      "https://example.com/path/to/resource/123/456/789?query=string#fragment"
    ),
    "/path/to/resource/123/456/789"
  );
});
