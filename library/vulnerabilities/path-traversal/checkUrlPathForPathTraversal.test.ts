import * as t from "tap";
import { checkUrlPathForPathTraversal } from "./checkUrlPathForPathTraversal";

t.test("it does not detect", async (t) => {
  t.equal(checkUrlPathForPathTraversal("").found, false);
  t.equal(checkUrlPathForPathTraversal("").payload, undefined);
  t.equal(checkUrlPathForPathTraversal("abc").found, false);
  t.equal(checkUrlPathForPathTraversal("/").found, false);
  t.equal(checkUrlPathForPathTraversal("/abc").found, false);
  t.equal(checkUrlPathForPathTraversal("/a?test=123").found, false);

  t.equal(
    checkUrlPathForPathTraversal("https://example.com/path/to/resource").found,
    false
  );
  t.equal(
    checkUrlPathForPathTraversal("https://example.com/path/to/resource/").found,
    false
  );
  t.equal(
    checkUrlPathForPathTraversal("https://example.com/path/to/resource/123")
      .found,
    false
  );
  t.equal(
    checkUrlPathForPathTraversal("https://example.com/path/to/resource/123/456")
      .found,
    false
  );
  t.equal(
    checkUrlPathForPathTraversal(
      "https://example.com/path/to/resource/123/456/789"
    ).found,
    false
  );
  t.equal(
    checkUrlPathForPathTraversal(
      "https://example.com/path/to/resource/123/456/789?query=string"
    ).found,
    false
  );
  t.equal(
    checkUrlPathForPathTraversal(
      "https://example.com/path/to/resource/123/456/789#fragment"
    ).found,
    false
  );
  t.equal(
    checkUrlPathForPathTraversal(
      "https://example.com/path/to/resource/123/456/789?query=string#fragment"
    ).found,
    false
  );
  t.equal(
    checkUrlPathForPathTraversal("https://example.com/path/to/resource/%C3%A4")
      .found,
    false
  );

  // Invalid url encoded characters
  t.equal(
    checkUrlPathForPathTraversal("https://example.com/path/to/resource/%a")
      .found,
    false
  );
});

t.test("only detect in path segments", async (t) => {
  t.equal(checkUrlPathForPathTraversal("/test#/../").found, false);
  t.equal(checkUrlPathForPathTraversal("/test?param=/../etc").found, false); // Query parameters are checked differently
});

t.test("it detects", async (t) => {
  t.equal(checkUrlPathForPathTraversal("/..").found, true);
  t.equal(checkUrlPathForPathTraversal("/../").found, true);
  t.equal(checkUrlPathForPathTraversal("/abc/..").found, true);
  t.equal(checkUrlPathForPathTraversal("/abc/..").payload, "/abc/..");
  t.equal(checkUrlPathForPathTraversal("/abc/../def").found, true);
  t.equal(checkUrlPathForPathTraversal("/abc/def/..").found, true);
  t.equal(checkUrlPathForPathTraversal("/abc/def/../ghi").found, true);
  t.equal(checkUrlPathForPathTraversal("/abc/def/../../ghi").found, true);
  t.equal(checkUrlPathForPathTraversal("/abc/def/../../../ghi").found, true);

  // With backslashes
  t.equal(checkUrlPathForPathTraversal("/..\\").found, true);
  t.equal(checkUrlPathForPathTraversal("/..\\\\").found, true);
  t.equal(checkUrlPathForPathTraversal("/abc/..\\").found, true);

  // With URL encoding
  t.equal(checkUrlPathForPathTraversal("/%2E%2E").found, true);
  t.equal(checkUrlPathForPathTraversal("/%2E%2E/").found, true);
  t.equal(checkUrlPathForPathTraversal("/abc/%2E%2E").found, true);
  t.equal(checkUrlPathForPathTraversal("/abc/%2E%2E").payload, "/abc/%2E%2E");

  // With space characters
  t.equal(checkUrlPathForPathTraversal("/.%09./").found, true);
  t.equal(checkUrlPathForPathTraversal("/abc/.%0a./def").found, true);
  t.equal(checkUrlPathForPathTraversal("/abc/.%0D./def").found, true);
  t.equal(
    checkUrlPathForPathTraversal("/abc/.%0D./def").payload,
    "/abc/.%0D./def"
  );
});
