import * as t from "tap";
import type { Request } from "express";
import { contextFromRequest } from "./contextFromRequest";
import { clearTrustProxyCache } from "../../helpers/trustProxy";

t.beforeEach(() => {
  delete process.env.AIKIDO_TRUST_PROXY;
  clearTrustProxyCache();
});

function fakeRequest({
  headers,
  socketRemoteAddress,
}: {
  headers: Record<string, string>;
  socketRemoteAddress: string;
}): Request {
  return {
    protocol: "https",
    originalUrl: "/",
    method: "GET",
    headers,
    get(name: string) {
      return headers[name.toLowerCase()];
    },
    socket: { remoteAddress: socketRemoteAddress },
    body: undefined,
    params: {},
    query: {},
    cookies: {},
    subdomains: [],
  } as unknown as Request;
}

t.test(
  "isBehindTrustedProxy reflects the raw socket peer, not the header-resolved client IP",
  async (t) => {
    process.env.AIKIDO_TRUST_PROXY = "1.2.3.4/32";
    clearTrustProxyCache();

    const context = contextFromRequest(
      fakeRequest({
        headers: {
          host: "example.com",
          "x-forwarded-for": "9.9.9.9, 1.2.3.4",
        },
        socketRemoteAddress: "1.2.3.4",
      })
    );

    t.same(context.remoteAddress, "9.9.9.9");
    t.same(context.isBehindTrustedProxy, true);
  }
);

t.test(
  "isBehindTrustedProxy is false when the socket peer is not a trusted proxy",
  async (t) => {
    process.env.AIKIDO_TRUST_PROXY = "1.2.3.4/32";
    clearTrustProxyCache();

    const context = contextFromRequest(
      fakeRequest({
        headers: {
          host: "example.com",
          "x-forwarded-for": "9.9.9.9",
        },
        socketRemoteAddress: "5.5.5.5",
      })
    );

    t.same(context.remoteAddress, "5.5.5.5");
    t.same(context.isBehindTrustedProxy, false);
  }
);
