import * as t from "tap";
import { extractRegionFromToken } from "./extractRegionFromToken";

t.test("should return EU for empty token", async (t) => {
  t.equal(extractRegionFromToken(""), "EU");
});

t.test("should return EU for invalid token", async (t) => {
  t.equal(extractRegionFromToken("invalid-token"), "EU");
});

t.test(
  "should return EU for token not starting with AIK_RUNTIME_",
  async (t) => {
    t.equal(extractRegionFromToken("SOME_OTHER_TOKEN_123_456_US_abc"), "EU");
  }
);

t.test("should return EU for old format token without region", async (t) => {
  t.equal(extractRegionFromToken("AIK_RUNTIME_123_456_randomstring"), "EU");
});

t.test("should return US for new format token with US region", async (t) => {
  t.equal(extractRegionFromToken("AIK_RUNTIME_123_456_US_randomstring"), "US");
});

t.test("should return ME for new format token with ME region", async (t) => {
  t.equal(extractRegionFromToken("AIK_RUNTIME_123_456_ME_randomstring"), "ME");
});

t.test("should return EU for new format token with EU region", async (t) => {
  t.equal(extractRegionFromToken("AIK_RUNTIME_123_456_EU_randomstring"), "EU");
});

t.test("should return whatever prefix is there", async (t) => {
  t.equal(
    extractRegionFromToken("AIK_RUNTIME_123_456_CUSTOM_randomstring"),
    "CUSTOM"
  );
  t.equal(
    extractRegionFromToken("AIK_RUNTIME_123_456_123_randomstring"),
    "123"
  );
});

t.test("should return EU if region part is missing", async (t) => {
  t.equal(extractRegionFromToken("AIK_RUNTIME_123_456"), "EU");
  t.equal(extractRegionFromToken("AIK_RUNTIME_123"), "EU");
  t.equal(extractRegionFromToken("AIK_RUNTIME_"), "EU");
});
