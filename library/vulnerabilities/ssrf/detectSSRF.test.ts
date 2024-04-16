import * as t from "tap";
import { detectSSRF } from "./detectSSRF";

t.test("returns false if user input and hostname are empty", async (t) => {
  t.same(detectSSRF("", ""), false);
});

t.test("returns false if user input is empty", async (t) => {
  t.same(detectSSRF("", "example.com"), false);
});

t.test("returns false if hostname is empty", async (t) => {
  t.same(detectSSRF("http://example.com", ""), false);
});

t.test("it parses hostname from user input", async (t) => {
  t.same(detectSSRF("http://localhost", "localhost"), true);
});

t.test("it parses hostname from user input with path behind it", async (t) => {
  t.same(detectSSRF("http://localhost/path", "localhost"), true);
});

t.test(
  "it parses hostname from user input with misspelled protocol",
  async (t) => {
    t.same(detectSSRF("http:/localhost", "localhost"), true);
  }
);

t.test(
  "it parses hostname from user input without protocol seperator",
  async (t) => {
    t.same(detectSSRF("http:localhost", "localhost"), true);
  }
);

t.test("it detects private IP addresses behind a DNS record", async (t) => {
  t.same(detectSSRF("http://localtest.me", "localtest.me"), true);
});

t.test("it detects private IPv4 address using decimal encoding", async (t) => {
  t.same(detectSSRF("http://2130706433", "2130706433"), true);
});

t.test("it detects private IPv4 address using octal encoding", async (t) => {
  t.same(detectSSRF("http://0177.0.0.1", "0177.0.0.1"), true);
});

t.test("it detects private IPv6/IPv4 address embedding", async (t) => {
  t.same(
    detectSSRF(
      "http://[0:0:0:0:0:ffff:127.0.0.1]",
      "[0:0:0:0:0:ffff:127.0.0.1]"
    ),
    true
  );
});

t.test("it detects private IPv4 address by dropping zeros", async (t) => {
  t.same(detectSSRF("http://0/", "0"), true);
  t.same(detectSSRF("http://127.1", "127.1"), true);
  t.same(detectSSRF("http://127.0.1", "127.0.1"), true);
});

t.test(
  "it parses hostname from user input with misspelled protocol and path behind it",
  async (t) => {
    t.same(detectSSRF("http:/localhost/path/path", "localhost"), true);
  }
);

t.test(
  "it parses hostname from user input without protocol and path behind it",
  async (t) => {
    t.same(detectSSRF("localhost/path/path", "localhost"), true);
  }
);

t.test("it flags FTP as protocol", async (t) => {
  t.same(detectSSRF("ftp://localhost", "localhost"), true);
});

t.test("it parses hostname from user input", async (t) => {
  t.same(detectSSRF("localhost", "localhost"), true);
});

t.test("it ignores invalid URLs", async (t) => {
  t.same(detectSSRF("http://", "localhost"), false);
});

t.test("it detects private IPv4 address", async (t) => {
  t.same(detectSSRF("http://10.0.0.1", "10.0.0.1"), true);
  t.same(detectSSRF("http://169.254.169.254", "169.254.169.254"), true);
});

t.test("it detects private IPv4 address inside URL", async () => {
  t.same(
    detectSSRF("http://169.254.169.254/latest/meta-data/", "169.254.169.254"),
    true
  );
});

t.test("it ignores public IPv4 address", async (t) => {
  t.same(detectSSRF("http://74.125.133.99", "74.125.133.99"), false);
});

t.test("it checks for private IPv6 address", async (t) => {
  t.same(
    detectSSRF(
      "http://[febf:ffff:ffff:ffff:ffff:ffff:ffff:ffff]",
      "[febf:ffff:ffff:ffff:ffff:ffff:ffff:ffff]"
    ),
    true
  );
  t.same(detectSSRF("http://[fe80::1]", "[fe80::1]"), true);
  t.same(detectSSRF("http://[fd00:ec2::254]", "[fd00:ec2::254]"), true);
  t.same(detectSSRF("http://[::]:80/", "[::]"), true);
  t.same(detectSSRF("http://[0000::1]:80/", "[0000::1]"), true);
});

t.test("it ignores public IPv6 address", async (t) => {
  t.same(
    detectSSRF(
      "http://[2001:2:ffff:ffff:ffff:ffff:ffff:ffff]",
      "[2001:2:ffff:ffff:ffff:ffff:ffff:ffff]"
    ),
    false
  );
});

t.test("user input is smaller than hostname", async (t) => {
  t.same(detectSSRF("localhost", "localhost localhost"), false);
});
