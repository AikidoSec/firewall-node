import * as t from "tap";
import { getHostFromHTTP2Connect as get } from "./getHostFromHTTP2Connect";

t.test("it works with authority as string", async (t) => {
  t.same(get(["https://localhost"]), { hostname: "localhost", port: 443 });
  t.same(get(["https://localhost:4000"]), {
    hostname: "localhost",
    port: 4000,
  });
  t.same(get(["https://localhost:4000/test?q=1"]), {
    hostname: "localhost",
    port: 4000,
  });
  t.same(get(["http://localhost"]), { hostname: "localhost", port: 80 });
});

t.test("it works with authority as URL", async (t) => {
  t.same(get([new URL("https://localhost")]), {
    hostname: "localhost",
    port: 443,
  });
  t.same(get([new URL("http://localhost")]), {
    hostname: "localhost",
    port: 80,
  });
  t.same(get([new URL("https://localhost:4000")]), {
    hostname: "localhost",
    port: 4000,
  });
  t.same(get([new URL("https://localhost:4000/test?q=1")]), {
    hostname: "localhost",
    port: 4000,
  });
});

t.test("it works with an url like object", async (t) => {
  t.same(get([{ protocol: "https:", hostname: "localhost" }]), {
    hostname: "localhost",
    port: 443,
  });
  t.same(get([{ hostname: "localhost" }]), {
    hostname: "localhost",
    port: 443,
  });
  t.same(get([{ host: "localhost", protocol: "http:" }]), {
    hostname: "localhost",
    port: 80,
  });
  t.same(get([{ host: "localhost" }]), {
    hostname: "localhost",
    port: 443,
  });
  t.same(get([{ protocol: "https:", hostname: "localhost", port: 4000 }]), {
    hostname: "localhost",
    port: 4000,
  });
  t.same(get([{ hostname: "localhost", port: 4000 }]), {
    hostname: "localhost",
    port: 4000,
  });
  t.same(get([{ hostname: "localhost", port: "123" }]), {
    hostname: "localhost",
    port: 123,
  });
  t.same(get([{ hostname: "localhost", port: "invalid" }]), undefined);
});

t.test("invalid arguments", async (t) => {
  t.same(get([]), undefined);
  t.same(get([null]), undefined);
  t.same(get([undefined]), undefined);
  t.same(get([1]), undefined);
  t.same(get(["%test%"]), undefined);
});
