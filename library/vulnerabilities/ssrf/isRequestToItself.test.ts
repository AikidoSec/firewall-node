import * as t from "tap";
import { isRequestToItself } from "./isRequestToItself";

t.test("it returns false if server url is empty", async (t) => {
  t.same(
    false,
    isRequestToItself({
      serverUrl: "",
      outboundHostname: "aikido.dev",
      outboundPort: 80,
      isBehindTrustedProxy: true,
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
      isBehindTrustedProxy: true,
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
      isBehindTrustedProxy: true,
    })
  );
  t.same(
    false,
    isRequestToItself({
      serverUrl: "https://aikido.dev:4000",
      outboundHostname: "aikido.dev",
      outboundPort: 443,
      isBehindTrustedProxy: true,
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
      isBehindTrustedProxy: true,
    })
  );
  t.same(
    false,
    isRequestToItself({
      serverUrl: "https://aikido.dev",
      outboundHostname: "aikido.dev",
      outboundPort: undefined,
      isBehindTrustedProxy: true,
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
      isBehindTrustedProxy: true,
    })
  );
  t.same(
    false,
    isRequestToItself({
      serverUrl: "http://aikido.dev:4000",
      outboundHostname: "google.com",
      outboundPort: 4000,
      isBehindTrustedProxy: true,
    })
  );
  t.same(
    false,
    isRequestToItself({
      serverUrl: "https://aikido.dev",
      outboundHostname: "google.com",
      outboundPort: 443,
      isBehindTrustedProxy: true,
    })
  );
  t.same(
    false,
    isRequestToItself({
      serverUrl: "https://aikido.dev:4000",
      outboundHostname: "google.com",
      outboundPort: 443,
      isBehindTrustedProxy: true,
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
      isBehindTrustedProxy: true,
    })
  );

  t.same(
    true,
    isRequestToItself({
      serverUrl: "http://aikido.dev:4000",
      outboundHostname: "aikido.dev",
      outboundPort: 4000,
      isBehindTrustedProxy: true,
    })
  );

  t.same(
    true,
    isRequestToItself({
      serverUrl: "http://aikido.dev",
      outboundHostname: "aikido.dev",
      outboundPort: 80,
      isBehindTrustedProxy: true,
    })
  );

  t.same(
    true,
    isRequestToItself({
      serverUrl: "https://aikido.dev:4000",
      outboundHostname: "aikido.dev",
      outboundPort: 4000,
      isBehindTrustedProxy: true,
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
      isBehindTrustedProxy: true,
    })
  );

  t.same(
    true,
    isRequestToItself({
      serverUrl: "https://aikido.dev",
      outboundHostname: "aikido.dev",
      outboundPort: 80,
      isBehindTrustedProxy: true,
    })
  );
});

t.test(
  "it returns false if the remote address is not a trusted proxy",
  async (t) => {
    t.same(
      false,
      isRequestToItself({
        serverUrl: "https://aikido.dev",
        outboundHostname: "aikido.dev",
        outboundPort: 443,
        isBehindTrustedProxy: false,
      })
    );

    t.same(
      false,
      isRequestToItself({
        serverUrl: "http://aikido.dev",
        outboundHostname: "aikido.dev",
        outboundPort: 80,
        isBehindTrustedProxy: false,
      })
    );
  }
);
