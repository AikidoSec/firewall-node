import * as t from "tap";
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
