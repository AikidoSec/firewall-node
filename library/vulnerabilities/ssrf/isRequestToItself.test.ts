import * as t from "tap";
import { isRequestToItself } from "./isRequestToItself";

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
    })
  );
  t.same(
    false,
    isRequestToItself({
      serverUrl: "https://aikido.dev:4000",
      outboundHostname: "aikido.dev",
      outboundPort: 443,
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
    })
  );
  t.same(
    false,
    isRequestToItself({
      serverUrl: "https://aikido.dev",
      outboundHostname: "aikido.dev",
      outboundPort: undefined,
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
    })
  );
  t.same(
    false,
    isRequestToItself({
      serverUrl: "http://aikido.dev:4000",
      outboundHostname: "google.com",
      outboundPort: 4000,
    })
  );
  t.same(
    false,
    isRequestToItself({
      serverUrl: "https://aikido.dev",
      outboundHostname: "google.com",
      outboundPort: 443,
    })
  );
  t.same(
    false,
    isRequestToItself({
      serverUrl: "https://aikido.dev:4000",
      outboundHostname: "google.com",
      outboundPort: 443,
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
    })
  );

  t.same(
    true,
    isRequestToItself({
      serverUrl: "http://aikido.dev:4000",
      outboundHostname: "aikido.dev",
      outboundPort: 4000,
    })
  );

  t.same(
    true,
    isRequestToItself({
      serverUrl: "http://aikido.dev",
      outboundHostname: "aikido.dev",
      outboundPort: 80,
    })
  );

  t.same(
    true,
    isRequestToItself({
      serverUrl: "https://aikido.dev:4000",
      outboundHostname: "aikido.dev",
      outboundPort: 4000,
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
    })
  );

  t.same(
    true,
    isRequestToItself({
      serverUrl: "https://aikido.dev",
      outboundHostname: "aikido.dev",
      outboundPort: 80,
    })
  );
});

t.test("it returns false if trust proxy is false", async (t) => {
  // Trust proxy is enabled by default
  process.env.AIKIDO_TRUST_PROXY = "false";

  t.same(
    false,
    isRequestToItself({
      serverUrl: "https://aikido.dev",
      outboundHostname: "aikido.dev",
      outboundPort: 443,
    })
  );

  t.same(
    false,
    isRequestToItself({
      serverUrl: "http://aikido.dev",
      outboundHostname: "aikido.dev",
      outboundPort: 80,
    })
  );
});
