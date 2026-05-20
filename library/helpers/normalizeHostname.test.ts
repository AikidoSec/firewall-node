import * as t from "tap";
import { normalizeHostname } from "./normalizeHostname";

t.test("strips trailing dot", async (t) => {
  t.same(normalizeHostname("example.com."), "example.com");
  t.same(normalizeHostname("sub.example.com."), "sub.example.com");
  t.same(normalizeHostname("localhost."), "localhost");
});

t.test("leaves normal hostnames unchanged", async (t) => {
  t.same(normalizeHostname("example.com"), "example.com");
  t.same(normalizeHostname("localhost"), "localhost");
  t.same(normalizeHostname("192.168.1.1"), "192.168.1.1");
  t.same(normalizeHostname(""), "");
});

t.test("converts punycode to unicode", async (t) => {
  t.same(normalizeHostname("xn--bse-sna.example.com"), "böse.example.com");
  t.same(
    normalizeHostname("xn--mnchen-allowed-gsb.example.com"),
    "münchen-allowed.example.com"
  );
  t.same(
    normalizeHostname("xn--mnchen-3ya.example.com"),
    "münchen.example.com"
  );
});

t.test("converts punycode to unicode with trailing dot", async (t) => {
  t.same(normalizeHostname("xn--bse-sna.example.com."), "böse.example.com");
});
