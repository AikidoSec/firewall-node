import * as t from "tap";
import { Hostname } from "../../vulnerabilities/ssrf/Hostname";
import { getHostnameAndPortFromArgs as get } from "./getHostnameAndPortFromArgs";
import { parse as parseUrl } from "url";

t.test("it works with url string", async (t) => {
  t.same(get(["http://localhost:4000"]), {
    hostname: Hostname.fromString("localhost"),
    port: 4000,
  });
  t.same(get(["http://localhost?test=1"]), {
    hostname: Hostname.fromString("localhost"),
    port: 80,
  });
  t.same(get(["https://localhost"]), {
    hostname: Hostname.fromString("localhost"),
    port: 443,
  });
});

t.test("it works with url object", async (t) => {
  t.same(get([new URL("http://localhost:4000")]), {
    hostname: Hostname.fromString("localhost"),
    port: 4000,
  });
  t.same(get([new URL("http://localhost?test=1")]), {
    hostname: Hostname.fromString("localhost"),
    port: 80,
  });
  t.same(get([new URL("https://localhost")]), {
    hostname: Hostname.fromString("localhost"),
    port: 443,
  });
});

t.test("it works with an array of strings", async (t) => {
  t.same(get([["http://localhost:4000"]]), {
    hostname: Hostname.fromString("localhost"),
    port: 4000,
  });
  t.same(get([["http://localhost?test=1"]]), {
    hostname: Hostname.fromString("localhost"),
    port: 80,
  });
  t.same(get([["https://localhost"]]), {
    hostname: Hostname.fromString("localhost"),
    port: 443,
  });
});

t.test("it works with an legacy url object", async (t) => {
  t.same(get([parseUrl("http://localhost:4000")]), {
    hostname: Hostname.fromString("localhost"),
    port: 4000,
  });
  t.same(get([parseUrl("http://localhost?test=1")]), {
    hostname: Hostname.fromString("localhost"),
    port: 80,
  });
  t.same(get([parseUrl("https://localhost")]), {
    hostname: Hostname.fromString("localhost"),
    port: 443,
  });
});

t.test("it works with an options object containing origin", async (t) => {
  t.same(get([{ origin: "http://localhost:4000" }]), {
    hostname: Hostname.fromString("localhost"),
    port: 4000,
  });
  t.same(get([{ origin: "http://localhost?test=1" }]), {
    hostname: Hostname.fromString("localhost"),
    port: 80,
  });
  t.same(get([{ origin: "https://localhost" }]), {
    hostname: Hostname.fromString("localhost"),
    port: 443,
  });
});

t.test(
  "it works with an options object containing protocol, hostname and port",
  async (t) => {
    t.same(get([{ protocol: "http:", hostname: "localhost", port: 4000 }]), {
      hostname: Hostname.fromString("localhost"),
      port: 4000,
    });
    t.same(get([{ hostname: "localhost", port: 4000 }]), {
      hostname: Hostname.fromString("localhost"),
      port: 4000,
    });
    t.same(get([{ protocol: "https:", hostname: "localhost" }]), {
      hostname: Hostname.fromString("localhost"),
      port: 443,
    });
  }
);

t.test("invalid origin url", async (t) => {
  t.same(get([{ origin: "invalid url" }]), undefined);
  t.same(get([{ origin: "" }]), undefined);
});

t.test("without hostname", async (t) => {
  t.same(get([{}]), undefined);
  t.same(get([{ protocol: "https:", port: 4000 }]), undefined);
});

t.test("invalid hostname", async (t) => {
  t.same(get([{ protocol: "https:", hostname: " " }]), undefined);
});

t.test("empty args", async (t) => {
  t.same(get([]), undefined);
});
