import t from "tap";
import isBase64String from "./isBase64String";

t.test("is a base64 string", async (t) => {
  t.same(isBase64String("QUlLSURP"), true);
  t.same(isBase64String("QUlLSURPIFNFQw=="), true);
  t.same(isBase64String("QUlLSURPIFNFQ1VSSVRZ"), true);
  t.same(isBase64String("QUlLSURPIFNFQ1VSSVRZIGlzIGF3ZXNvbWU="), true);
  t.same(
    isBase64String("QUlLSURPIFNFQ1VSSVRZIGlzIGF3ZXNvbWUhISEhISEhIQ=="),
    true
  );
});

t.test("is not a base64 string", async (t) => {
  t.same(isBase64String(""), false);
  t.same(isBase64String("QUlLSURP="), false);
  t.same(isBase64String("QUlLSURPIFNFQw"), false);
  t.same(isBase64String("test!"), false);
  t.same(isBase64String("test"), false); // This is a valid base64 string, but I assume we do not want do detect it as such
});
