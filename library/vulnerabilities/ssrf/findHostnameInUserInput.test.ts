import * as t from "tap";
import { findHostnameInUserInput } from "./findHostnameInUserInput";
import { Hostname } from "./Hostname";

t.test("returns false if user input is empty", async (t) => {
  t.same(
    findHostnameInUserInput("", Hostname.fromString("example.com")!),
    false
  );
});

t.test("it parses hostname from user input", async (t) => {
  t.same(
    findHostnameInUserInput(
      "http://localhost",
      Hostname.fromString("localhost")!
    ),
    true
  );
});

t.test("it parses special IP", async (t) => {
  t.same(
    findHostnameInUserInput(
      "http://localhost",
      Hostname.fromString("localhost")!
    ),
    true
  );
});

t.test("it parses hostname from user input with path behind it", async (t) => {
  t.same(
    findHostnameInUserInput(
      "http://localhost/path",
      Hostname.fromString("localhost")!
    ),
    true
  );
});

t.test(
  "it parses hostname from user input with misspelled protocol",
  async (t) => {
    t.same(
      findHostnameInUserInput(
        "http:/localhost",
        Hostname.fromString("localhost")!
      ),
      true
    );
  }
);

t.test(
  "it parses hostname from user input without protocol separator",
  async (t) => {
    t.same(
      findHostnameInUserInput(
        "http:localhost",
        Hostname.fromString("localhost")!
      ),
      true
    );
  }
);

t.test(
  "it parses hostname from user input with misspelled protocol and path behind it",
  async (t) => {
    t.same(
      findHostnameInUserInput(
        "http:/localhost/path/path",
        Hostname.fromString("localhost")!
      ),
      true
    );
  }
);

t.test(
  "it parses hostname from user input without protocol and path behind it",
  async (t) => {
    t.same(
      findHostnameInUserInput(
        "localhost/path/path",
        Hostname.fromString("localhost")!
      ),
      true
    );
  }
);

t.test("it flags FTP as protocol", async (t) => {
  t.same(
    findHostnameInUserInput(
      "ftp://localhost",
      Hostname.fromString("localhost")!
    ),
    true
  );
});

t.test("it parses hostname from user input", async (t) => {
  t.same(
    findHostnameInUserInput("localhost", Hostname.fromString("localhost")!),
    true
  );
});

t.test("it ignores invalid URLs", async (t) => {
  t.same(
    findHostnameInUserInput("http://", Hostname.fromString("localhost")!),
    false
  );
});

t.test("user input is smaller than hostname", async (t) => {
  t.same(
    findHostnameInUserInput(
      "localhost",
      Hostname.fromString("localhost-localhost")!
    ),
    false
  );
});

t.test("it find IP address inside URL", async () => {
  t.same(
    findHostnameInUserInput(
      "http://169.254.169.254/latest/meta-data/",
      Hostname.fromString("169.254.169.254")!
    ),
    true
  );
});

t.test("it find IP address with strange notation inside URL", async () => {
  t.same(
    findHostnameInUserInput(
      "http://2130706433",
      Hostname.fromString("2130706433")!
    ),
    true
  );
  t.same(
    findHostnameInUserInput("http://127.1", Hostname.fromString("127.1")!),
    true
  );
  t.same(
    findHostnameInUserInput("http://127.0.1", Hostname.fromString("127.0.1")!),
    true
  );
});

t.test("it works with ports", async () => {
  t.same(
    findHostnameInUserInput(
      "http://localhost",
      Hostname.fromString("localhost")!,
      8080
    )!,
    false
  );
  t.same(
    findHostnameInUserInput(
      "http://localhost:8080",
      Hostname.fromString("localhost")!,
      8080
    )!,
    true
  );
  // If port is not specified, it should return true
  t.same(
    findHostnameInUserInput(
      "http://localhost:8080",
      Hostname.fromString("localhost")!
    )!,
    true
  );
  t.same(
    findHostnameInUserInput(
      "http://localhost:8080",
      Hostname.fromString("localhost")!,
      4321
    ),
    false
  );
});
