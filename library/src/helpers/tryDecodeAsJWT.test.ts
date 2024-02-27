import * as t from "tap";
import { tryDecodeAsJWT } from "./tryDecodeAsJWT";

t.test("it returns undefined for empty string", async () => {
  t.same(tryDecodeAsJWT(""), { jwt: false });
});

t.test("it returns undefined for invalid JWT", async () => {
  t.same(tryDecodeAsJWT("invalid"), { jwt: false });
  t.same(tryDecodeAsJWT("invalid.invalid"), { jwt: false });
  t.same(tryDecodeAsJWT("invalid.invalid.invalid"), { jwt: false });
  t.same(tryDecodeAsJWT("invalid.invalid.invalid.invalid"), { jwt: false });
});
