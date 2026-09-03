import * as t from "tap";
import { isRequestToItself } from "./isRequestToItself";
import { clearTrustProxyCache } from "../../helpers/trustProxy";

t.beforeEach(() => {
  delete process.env.AIKIDO_TRUST_PROXY;
});

t.test("it returns false if server url is empty", async (t) => {
  t.same(
    false,
    isRequestToItself({
      serverUrl: "",
      outboundHostname: "aikido.dev",
      outboundPort: 80,
      remoteAddress: undefined,
    })
  );
});

t.test("it returns false if server url is invalid", async (t) => {
  t.same(
    false,
    isRequestToItself({
      serverUrl: "http://",
      outboundHostname: "aikido.dev",
      outboundPort: 80,
      remoteAddress: undefined,
    })
  );
});

t.test("it returns false if port is different", async (t) => {
  t.same(
    false,
    isRequestToItself({
      serverUrl: "http://aikido.dev:4000",
      outboundHostname: "aikido.dev",
      outboundPort: 80,
      remoteAddress: undefined,
    })
  );
  t.same(
    false,
    isRequestToItself({
      serverUrl: "https://aikido.dev:4000",
      outboundHostname: "aikido.dev",
      outboundPort: 443,
      remoteAddress: undefined,
    })
  );
});

t.test("it returns false if outbound port is undefined", async (t) => {
  t.same(
    false,
    isRequestToItself({
      serverUrl: "http://aikido.dev",
      outboundHostname: "aikido.dev",
      outboundPort: undefined,
      remoteAddress: undefined,
    })
  );
  t.same(
    false,
    isRequestToItself({
      serverUrl: "https://aikido.dev",
      outboundHostname: "aikido.dev",
      outboundPort: undefined,
      remoteAddress: undefined,
    })
  );
});

t.test("it returns false if hostname is different", async (t) => {
  t.same(
    false,
    isRequestToItself({
      serverUrl: "http://aikido.dev",
      outboundHostname: "google.com",
      outboundPort: 80,
      remoteAddress: undefined,
    })
  );
  t.same(
    false,
    isRequestToItself({
      serverUrl: "http://aikido.dev:4000",
      outboundHostname: "google.com",
      outboundPort: 4000,
      remoteAddress: undefined,
    })
  );
  t.same(
    false,
    isRequestToItself({
      serverUrl: "https://aikido.dev",
      outboundHostname: "google.com",
      outboundPort: 443,
      remoteAddress: undefined,
    })
  );
  t.same(
    false,
    isRequestToItself({
      serverUrl: "https://aikido.dev:4000",
      outboundHostname: "google.com",
      outboundPort: 443,
      remoteAddress: undefined,
    })
  );
});

t.test("it returns true if server does request to itself", async (t) => {
  t.same(
    true,
    isRequestToItself({
      serverUrl: "https://aikido.dev",
      outboundHostname: "aikido.dev",
      outboundPort: 443,
      remoteAddress: undefined,
    })
  );

  t.same(
    true,
    isRequestToItself({
      serverUrl: "http://aikido.dev:4000",
      outboundHostname: "aikido.dev",
      outboundPort: 4000,
      remoteAddress: undefined,
    })
  );

  t.same(
    true,
    isRequestToItself({
      serverUrl: "http://aikido.dev",
      outboundHostname: "aikido.dev",
      outboundPort: 80,
      remoteAddress: undefined,
    })
  );

  t.same(
    true,
    isRequestToItself({
      serverUrl: "https://aikido.dev:4000",
      outboundHostname: "aikido.dev",
      outboundPort: 4000,
      remoteAddress: undefined,
    })
  );
});

t.test("it returns true for special case HTTP<->HTTPS", async (t) => {
  t.same(
    true,
    isRequestToItself({
      serverUrl: "http://aikido.dev",
      outboundHostname: "aikido.dev",
      outboundPort: 443,
      remoteAddress: undefined,
    })
  );

  t.same(
    true,
    isRequestToItself({
      serverUrl: "https://aikido.dev",
      outboundHostname: "aikido.dev",
      outboundPort: 80,
      remoteAddress: undefined,
    })
  );
});

t.test("it returns false if trust proxy is false", async (t) => {
  // Trust proxy is enabled by default
  process.env.AIKIDO_TRUST_PROXY = "false";
  clearTrustProxyCache();

  t.same(
    false,
    isRequestToItself({
      serverUrl: "https://aikido.dev",
      outboundHostname: "aikido.dev",
      outboundPort: 443,
      remoteAddress: undefined,
    })
  );

  t.same(
    false,
    isRequestToItself({
      serverUrl: "http://aikido.dev",
      outboundHostname: "aikido.dev",
      outboundPort: 80,
      remoteAddress: undefined,
    })
  );
});

t.test(
  "it returns false in CIDR mode if remoteAddress is not a trusted proxy",
  async (t) => {
    process.env.AIKIDO_TRUST_PROXY = "1.2.3.4/32";
    clearTrustProxyCache();

    t.same(
      false,
      isRequestToItself({
        serverUrl: "https://aikido.dev",
        outboundHostname: "aikido.dev",
        outboundPort: 443,
        remoteAddress: "5.5.5.5",
      })
    );
    t.same(
      false,
      isRequestToItself({
        serverUrl: "https://aikido.dev",
        outboundHostname: "aikido.dev",
        outboundPort: 443,
        remoteAddress: undefined,
      })
    );
  }
);

t.test(
  "it returns true in CIDR mode if remoteAddress is a trusted proxy",
  async (t) => {
    process.env.AIKIDO_TRUST_PROXY = "1.2.3.4/32";
    clearTrustProxyCache();

    t.same(
      true,
      isRequestToItself({
        serverUrl: "https://aikido.dev",
        outboundHostname: "aikido.dev",
        outboundPort: 443,
        remoteAddress: "1.2.3.4",
      })
    );
  }
);

t.test(
  "it returns true in count mode regardless of remoteAddress",
  async (t) => {
    process.env.AIKIDO_TRUST_PROXY = "2";
    clearTrustProxyCache();

    t.same(
      true,
      isRequestToItself({
        serverUrl: "https://aikido.dev",
        outboundHostname: "aikido.dev",
        outboundPort: 443,
        remoteAddress: "5.5.5.5",
      })
    );
  }
);
