import * as t from "tap";
import { isIMDSIPAddress } from "./imds";

t.test("it returns true for IMDS IP addresses", async (t) => {
  t.same(
    isIMDSIPAddress(
      new URL("http://169.254.169.254/latest/meta-data/").hostname
    ),
    true
  );
  t.same(
    isIMDSIPAddress(
      new URL("http://[fd00:ec2::254]/latest/meta-data/").hostname
        .replace("[", "")
        .replace("]", "")
    ),
    true
  );
  t.same(isIMDSIPAddress("100.100.100.200"), true);
});

t.test("it returns false for non-IMDS IP addresses", async (t) => {
  t.same(isIMDSIPAddress("1.2.3.4"), false);
  t.same(isIMDSIPAddress("example.com"), false);
});
