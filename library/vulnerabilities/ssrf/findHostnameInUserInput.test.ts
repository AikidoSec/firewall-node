import t from "tap";
import { findHostnameInUserInput } from "./findHostnameInUserInput";

t.test("returns false if user input and hostname are empty", async (t) => {
  t.same(findHostnameInUserInput("", ""), false);
});

t.test("returns false if user input is empty", async (t) => {
  t.same(findHostnameInUserInput("", "example.com"), false);
});

t.test("returns false if hostname is empty", async (t) => {
  t.same(findHostnameInUserInput("http://example.com", ""), false);
});

t.test("it parses hostname from user input", async (t) => {
  t.same(findHostnameInUserInput("http://localhost", "localhost"), true);
});

t.test("it parses special IP", async (t) => {
  t.same(findHostnameInUserInput("http://localhost", "localhost"), true);
});

t.test("it parses hostname from user input with path behind it", async (t) => {
  t.same(findHostnameInUserInput("http://localhost/path", "localhost"), true);
});

t.test(
  "it parses hostname from user input with misspelled protocol",
  async (t) => {
    t.same(findHostnameInUserInput("http:/localhost", "localhost"), true);
  }
);

t.test(
  "it parses hostname from user input without protocol separator",
  async (t) => {
    t.same(findHostnameInUserInput("http:localhost", "localhost"), true);
  }
);

t.test(
  "it parses hostname from user input with misspelled protocol and path behind it",
  async (t) => {
    t.same(
      findHostnameInUserInput("http:/localhost/path/path", "localhost"),
      true
    );
  }
);

t.test(
  "it parses hostname from user input without protocol and path behind it",
  async (t) => {
    t.same(findHostnameInUserInput("localhost/path/path", "localhost"), true);
  }
);

t.test("it flags FTP as protocol", async (t) => {
  t.same(findHostnameInUserInput("ftp://localhost", "localhost"), true);
});

t.test("it parses hostname from user input", async (t) => {
  t.same(findHostnameInUserInput("localhost", "localhost"), true);
});

t.test("it ignores invalid URLs", async (t) => {
  t.same(findHostnameInUserInput("http://", "localhost"), false);
});

t.test("user input is smaller than hostname", async (t) => {
  t.same(findHostnameInUserInput("localhost", "localhost localhost"), false);
});

t.test("it find IP address inside URL", async () => {
  t.same(
    findHostnameInUserInput(
      "http://169.254.169.254/latest/meta-data/",
      "169.254.169.254"
    ),
    true
  );
});

t.test("it find IP address with strange notation inside URL", async () => {
  t.same(findHostnameInUserInput("http://2130706433", "2130706433"), true);
  t.same(findHostnameInUserInput("http://127.1", "127.1"), true);
  t.same(findHostnameInUserInput("http://127.0.1", "127.0.1"), true);
});

t.test("it works with ports", async () => {
  t.same(findHostnameInUserInput("http://localhost", "localhost", 8080), false);
  t.same(
    findHostnameInUserInput("http://localhost:8080", "localhost", 8080),
    true
  );
  // If port is not specified, it should return true
  t.same(findHostnameInUserInput("http://localhost:8080", "localhost"), true);
  t.same(
    findHostnameInUserInput("http://localhost:8080", "localhost", 4321),
    false
  );
});

t.test("it normalizes trailing dot in hostname parameter", async (t) => {
  t.same(findHostnameInUserInput("http://example.com", "example.com."), true);
  t.same(findHostnameInUserInput("example.com", "example.com."), true);
});

t.test("it normalizes trailing dot in user input", async (t) => {
  t.same(findHostnameInUserInput("http://example.com.", "example.com"), true);
  t.same(findHostnameInUserInput("example.com.", "example.com"), true);
});

t.test("it normalizes trailing dot on both sides", async (t) => {
  t.same(findHostnameInUserInput("http://example.com.", "example.com."), true);
});

t.test("it reliably parses a Unicode hostname after warmup", async (t) => {
  for (let i = 0; i < 3_000; i++) {
    findHostnameInUserInput(`http://example.com/path/${i}`, "example.com", 80);
  }

  const userInput = JSON.parse(
    Buffer.concat([
      Buffer.from('{"url":"http://ssrf-r', "ascii"),
      Buffer.from([0xc3, 0xa9]),
      Buffer.from('directs.testssandbox.com/ssrf-test-4"}', "ascii"),
    ]).toString("utf8")
  ).url;

  t.same(
    findHostnameInUserInput(
      userInput,
      "xn--ssrf-rdirects-ghb.testssandbox.com",
      80
    ),
    true
  );
});
