import * as t from "tap";
import { isPrivateIP } from "./isPrivateIP";

t.test("private IPv6 addresses with a zone", async (t) => {
  t.equal(isPrivateIP("fe80::1%eth0"), true);
  t.equal(isPrivateIP("fe80::1%dummy0"), true);
  t.equal(isPrivateIP("::1%lo"), true);
});
