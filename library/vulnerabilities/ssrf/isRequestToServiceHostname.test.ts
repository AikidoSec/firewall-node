import * as t from "tap";
import { isRequestToServiceHostname } from "./isRequestToServiceHostname";

t.test("returns true for valid service hostnames", async (t) => {
  t.equal(isRequestToServiceHostname("valid_hostname"), true);
  t.equal(isRequestToServiceHostname("valid-hostname"), true);
  t.equal(
    isRequestToServiceHostname("hostname_with_underscores-and-dashes"),
    true
  );
  t.equal(isRequestToServiceHostname("a-b_c"), true);
});

t.test("returns false for hostnames with numbers", async (t) => {
  t.equal(isRequestToServiceHostname("valid123"), false);
  t.equal(isRequestToServiceHostname("123456"), false);
  t.equal(isRequestToServiceHostname("valid123&*()"), false);
});

t.test("returns false for empty strings", async (t) => {
  t.equal(isRequestToServiceHostname(""), false);
  t.equal(isRequestToServiceHostname(" "), false);
});

t.test("returns false for hostnames with invalid characters", async (t) => {
  t.equal(isRequestToServiceHostname("invalid@hostname"), false);
  t.equal(isRequestToServiceHostname("invalid#hostname"), false);
  t.equal(isRequestToServiceHostname("invalid/hostname"), false);
  t.equal(isRequestToServiceHostname("invalid:hostname"), false);
  t.equal(isRequestToServiceHostname("invalid;hostname"), false);
  t.equal(isRequestToServiceHostname("invalid.hostname"), false);
  t.equal(isRequestToServiceHostname("invalid_hostname!"), false);
  t.equal(isRequestToServiceHostname("invalid-hostname*"), false);
});

t.test(
  "returns true for edge cases with leading/trailing dashes and underscores",
  async (t) => {
    t.equal(isRequestToServiceHostname("-leadingdash"), true);
    t.equal(isRequestToServiceHostname("_leadingunderscore"), true);
    t.equal(isRequestToServiceHostname("trailingdash-"), true);
    t.equal(isRequestToServiceHostname("trailingunderscore_"), true);
    t.equal(isRequestToServiceHostname("dash--dash"), true);
    t.equal(isRequestToServiceHostname("underscore__underscore"), true);
  }
);

t.test("returns false for edge cases with dots", async (t) => {
  t.equal(isRequestToServiceHostname("-leadingdash."), false);
  t.equal(isRequestToServiceHostname("_leadingunderscore."), false);
  t.equal(isRequestToServiceHostname(".trailingdash-"), false);
  t.equal(isRequestToServiceHostname(".trailingunderscore_"), false);
  t.equal(isRequestToServiceHostname("dash--dash."), false);
  t.equal(isRequestToServiceHostname(".underscore__underscore"), false);
});

t.test("returns false for mixed valid and invalid characters", async (t) => {
  t.equal(isRequestToServiceHostname("valid_hostname!@#"), false);
  t.equal(isRequestToServiceHostname("valid-hostname$%^"), false);
  t.equal(isRequestToServiceHostname("valid123&*()"), false);
});

t.test("returns false for localhost variants", async (t) => {
  t.equal(isRequestToServiceHostname("localhost"), false);
  t.equal(isRequestToServiceHostname("LOCALHOST"), false);
  t.equal(isRequestToServiceHostname("LocalHost"), false);
  t.equal(isRequestToServiceHostname("localdomain"), false);
});

t.test("returns false for domain names", async (t) => {
  t.equal(isRequestToServiceHostname("localhost.localdomain"), false);
  t.equal(isRequestToServiceHostname("Host.docker.Internal"), false);
  t.equal(isRequestToServiceHostname("host.docker.internal"), false);
  t.equal(isRequestToServiceHostname("kubernetes.docker.internal"), false);
  t.equal(isRequestToServiceHostname("KUBERNETES.DOCKER.INTERNAL"), false);
  t.equal(isRequestToServiceHostname("google.com"), false);
  t.equal(isRequestToServiceHostname("subdomain.example.com"), false);
  t.equal(isRequestToServiceHostname("example.com"), false);
});

t.test("returns false for IP addresses", async (t) => {
  t.equal(isRequestToServiceHostname("127.0.0.1"), false);
  t.equal(isRequestToServiceHostname("192.168.1.1"), false);
  t.equal(isRequestToServiceHostname("255.255.255.255"), false);
  t.equal(isRequestToServiceHostname("0.0.0.0"), false);
  t.equal(isRequestToServiceHostname("::1"), false);
  t.equal(
    isRequestToServiceHostname("2001:0db8:85a3:0000:0000:8a2e:0370:7334"),
    false
  );
  t.equal(isRequestToServiceHostname("::ffff:192.168.1.1"), false);
  t.equal(isRequestToServiceHostname("2130706433"), false);
  t.equal(isRequestToServiceHostname("127.1"), false);
  t.equal(isRequestToServiceHostname("0"), false);
});

t.test("returns false for metadata hostname (IMDS exception)", async (t) => {
  t.equal(isRequestToServiceHostname("metadata"), false);
  t.equal(isRequestToServiceHostname("METADATA"), false);
  t.equal(isRequestToServiceHostname("Metadata"), false);
});
