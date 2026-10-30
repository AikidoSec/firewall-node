import { type IncomingMessage, type RequestOptions } from "http";
import * as t from "tap";
import * as net from "net";
import type { Test } from "tap";
import { Token } from "../agent/api/Token";
import { Context, runWithContext } from "../agent/Context";
import { HTTPRequest } from "./HTTPRequest";
import { createTestAgent } from "../helpers/createTestAgent";

function createContext(obj: Partial<Context> = {}): Context {
  return {
    remoteAddress: "::1",
    method: "POST",
    url: "http://localhost:4000",
    query: {},
    headers: {},
    body: { image: "http://localhost:4000/api/internal" },
    cookies: {},
    routeParams: {},
    source: "express",
    route: "/posts/:id",
    ...obj,
  };
}

const redirectTestUrl = "http://ssrf-redirects.testssandbox.com";
const redirectTestUrl2 =
  "http://firewallssrfredirects-env-2.eba-7ifve22q.eu-north-1.elasticbeanstalk.com";
const redirectTestUrl3 = "https://ssrf-rédirects.testssandbox.com";

const redirectUrl = {
  ip: `${redirectTestUrl}/ssrf-test`, // Redirects to http://127.0.0.1/test
  domain: `${redirectTestUrl}/ssrf-test-domain`, // Redirects to http://local.aikido.io/test
  ipTwice: `${redirectTestUrl}/ssrf-test-twice`, // Redirects to /ssrf-test
  domainTwice: `${redirectTestUrl}/ssrf-test-domain-twice`, // Redirects to /ssrf-test-domain
  ipv6: `${redirectTestUrl}/ssrf-test-ipv6`, // Redirects to http://[::1]/test
  ipv6Twice: `${redirectTestUrl}/ssrf-test-ipv6-twice`, // Redirects to /ssrf-test-ipv6
  protocolRelative: `${redirectTestUrl}/ssrf-test-protocol-relative`, // Redirects to //127.0.0.1/test
  protocolRelativeTwice: `${redirectTestUrl}/ssrf-test-protocol-relative-twice`, // Redirects to /ssrf-test-protocol-relative
  absoluteDomain: `${redirectTestUrl2}/ssrf-test-absolute-domain`, // Redirects to absoluteDomainTarget
  absoluteDomainTarget: `${redirectTestUrl2}/ssrf-test-domain`, // Redirects to http://local.aikido.io/test
  unicodeIp: `${redirectTestUrl3}/ssrf-test`, // Redirects to http://127.0.0.1/test
  unicodeDomain: `${redirectTestUrl3}/ssrf-test-domain`, // Redirects to http://local.aikido.io/test
  unicodeIpTwice: `${redirectTestUrl3}/ssrf-test-twice`, // Redirects to /ssrf-test
  unicodeDomainTwice: `${redirectTestUrl3}/ssrf-test-domain-twice`, // Redirects to /ssrf-test-domain
  unicodeAbsoluteDomain: `${redirectTestUrl3}/ssrf-test-absolute-domain`, // Redirects to absoluteDomainTarget
};

function consumeBody(res: IncomingMessage) {
  // We need to consume the body
  // From Node.19+ this would otherwise hang the test
  res.on("readable", () => {
    while (res.read() !== null) {
      // Keep reading until the stream is empty
    }
  });
}

const agent = createTestAgent({
  token: new Token("123"),
});
agent.start([new HTTPRequest()]);

const http = require("http") as typeof import("http");
const https = require("https") as typeof import("https");

function getModuleName(url: string) {
  return new URL(url).protocol === "https:" ? "https" : "http";
}

function getModule(url: string) {
  return getModuleName(url) === "https" ? https : http;
}

function getResponse(url: string, requestOptions: RequestOptions = {}) {
  return new Promise<IncomingMessage>((resolve, reject) => {
    getModule(url)
      .request(url, requestOptions, (res: IncomingMessage) => {
        consumeBody(res);
        resolve(res);
      })
      .on("error", reject)
      .end();
  });
}

function getBlockError(url: string) {
  return new Promise<Error | undefined>((resolve) => {
    try {
      const request = getModule(url).request(url);
      request.on("error", resolve);
      request.on("response", (res: IncomingMessage) => {
        consumeBody(res);
        resolve(undefined);
      });
      request.end();
    } catch (error) {
      resolve(error as Error);
    }
  });
}

async function testRedirectIsBlocked(
  t: Test,
  {
    userInput,
    inputKey = "image",
    redirectRequests,
    requestOptions,
    blockedUrl,
  }: {
    userInput: string;
    inputKey?: string;
    redirectRequests: string[];
    requestOptions?: RequestOptions;
    blockedUrl: string;
  }
) {
  await runWithContext(
    createContext({ body: { [inputKey]: userInput } }),
    async () => {
      for (const url of redirectRequests) {
        const res = await getResponse(url, requestOptions);
        t.same(res.statusCode, 302);
      }

      const error = await getBlockError(blockedUrl);
      t.ok(error instanceof Error);
      if (error instanceof Error) {
        t.same(
          error.message,
          `Zen has blocked a server-side request forgery: ${getModuleName(blockedUrl)}.request(...) originating from body.${inputKey}`
        );
      }
    }
  );
}

t.test("it blocks redirects to IP addresses", async (t) => {
  await testRedirectIsBlocked(t, {
    userInput: redirectUrl.ip,
    redirectRequests: [redirectUrl.ip],
    blockedUrl: "http://127.0.0.1/test",
  });
});

t.test(
  "it blocks redirects to domains that resolve to private IPs",
  async (t) => {
    await testRedirectIsBlocked(t, {
      userInput: redirectUrl.domain,
      inputKey: "test",
      redirectRequests: [redirectUrl.domain],
      blockedUrl: "http://local.aikido.io/test",
    });
  }
);

t.test(
  "it blocks redirects to IP addresses after a relative redirect",
  async (t) => {
    await testRedirectIsBlocked(t, {
      userInput: redirectUrl.ipTwice,
      redirectRequests: [redirectUrl.ipTwice, redirectUrl.ip],
      blockedUrl: "http://127.0.0.1/test",
    });
  }
);

t.test(
  "it blocks redirects to domains after a relative redirect",
  async (t) => {
    await testRedirectIsBlocked(t, {
      userInput: redirectUrl.domainTwice,
      redirectRequests: [redirectUrl.domainTwice, redirectUrl.domain],
      blockedUrl: "http://local.aikido.io/test",
    });
  }
);

t.test(
  "it blocks redirects to domains after an absolute redirect",
  async (t) => {
    await testRedirectIsBlocked(t, {
      userInput: redirectUrl.absoluteDomain,
      redirectRequests: [
        redirectUrl.absoluteDomain,
        redirectUrl.absoluteDomainTarget,
      ],
      blockedUrl: "http://local.aikido.io/test",
    });
  }
);

t.test("it blocks redirects to IPv6 addresses", async (t) => {
  await testRedirectIsBlocked(t, {
    userInput: redirectUrl.ipv6,
    redirectRequests: [redirectUrl.ipv6],
    blockedUrl: "http://[::1]/test",
  });
});

t.test(
  "it blocks redirects to IPv6 addresses after a relative redirect",
  async (t) => {
    await testRedirectIsBlocked(t, {
      userInput: redirectUrl.ipv6Twice,
      redirectRequests: [redirectUrl.ipv6Twice, redirectUrl.ipv6],
      blockedUrl: "http://[::1]/test",
    });
  }
);

t.test("it blocks protocol-relative redirects", async (t) => {
  await testRedirectIsBlocked(t, {
    userInput: redirectUrl.protocolRelative,
    redirectRequests: [redirectUrl.protocolRelative],
    blockedUrl: "http://127.0.0.1/test",
  });
});

t.test(
  "it blocks protocol-relative redirects after a relative redirect",
  async (t) => {
    await testRedirectIsBlocked(t, {
      userInput: redirectUrl.protocolRelativeTwice,
      redirectRequests: [
        redirectUrl.protocolRelativeTwice,
        redirectUrl.protocolRelative,
      ],
      blockedUrl: "http://127.0.0.1/test",
    });
  }
);

t.test(
  "it blocks redirects to IP addresses from unicode hostnames",
  async (t) => {
    await testRedirectIsBlocked(t, {
      userInput: redirectUrl.unicodeIp,
      redirectRequests: [redirectUrl.unicodeIp],
      blockedUrl: "http://127.0.0.1/test",
    });
  }
);

t.test("it blocks redirects to domains from unicode hostnames", async (t) => {
  await testRedirectIsBlocked(t, {
    userInput: redirectUrl.unicodeDomain,
    redirectRequests: [redirectUrl.unicodeDomain],
    blockedUrl: "http://local.aikido.io/test",
  });
});

t.test(
  "it blocks redirects to IP addresses from unicode hostnames after a relative redirect",
  async (t) => {
    await testRedirectIsBlocked(t, {
      userInput: redirectUrl.unicodeIpTwice,
      redirectRequests: [redirectUrl.unicodeIpTwice, redirectUrl.unicodeIp],
      blockedUrl: "http://127.0.0.1/test",
    });
  }
);

t.test(
  "it blocks redirects to domains from unicode hostnames after a relative redirect",
  async (t) => {
    await testRedirectIsBlocked(t, {
      userInput: redirectUrl.unicodeDomainTwice,
      redirectRequests: [
        redirectUrl.unicodeDomainTwice,
        redirectUrl.unicodeDomain,
      ],
      blockedUrl: "http://local.aikido.io/test",
    });
  }
);

t.test(
  "it blocks redirects to domains from unicode hostnames after an absolute redirect",
  async (t) => {
    await testRedirectIsBlocked(t, {
      userInput: redirectUrl.unicodeAbsoluteDomain,
      redirectRequests: [
        redirectUrl.unicodeAbsoluteDomain,
        redirectUrl.absoluteDomainTarget,
      ],
      blockedUrl: "http://local.aikido.io/test",
    });
  }
);

t.test("it blocks redirects if the Host header is changed", async (t) => {
  await testRedirectIsBlocked(t, {
    userInput: redirectUrl.ip,
    redirectRequests: [redirectUrl.ip],
    requestOptions: { headers: { host: "example.com" } },
    blockedUrl: "http://127.0.0.1/test",
  });
});

t.test("it uses the port of the request to detect redirects", async (t) => {
  await runWithContext(
    createContext({
      body: { image: "http://ssrf-redirects.testssandbox.com:8080/ssrf-test" },
    }),
    async () => {
      const res = await getResponse(redirectUrl.ip);
      t.same(res.statusCode, 302);

      // The redirect is not stored, so the request is not blocked (it fails to connect)
      const error = await getBlockError("http://127.0.0.1/test");
      t.notMatch(
        error?.message,
        /Zen has blocked a server-side request forgery/
      );
    }
  );
});

t.test("it uses the port of a custom agent to detect redirects", async (t) => {
  class PortRemapAgent extends http.Agent {
    constructor() {
      super({ defaultPort: 8080 });
    }

    createConnection(options: any, callback: any) {
      return net.createConnection({ ...options, port: 80 }, callback);
    }
  }

  await runWithContext(
    createContext({
      body: { image: "http://ssrf-redirects.testssandbox.com:8080/ssrf-test" },
    }),
    async () => {
      const res = await getResponse(redirectUrl.ip, {
        agent: new PortRemapAgent(),
        headers: { host: "ssrf-redirects.testssandbox.com" },
      });
      t.same(res.statusCode, 302);

      const error = await getBlockError("http://127.0.0.1/test");
      t.ok(error instanceof Error);
      t.match(
        error?.message,
        "Zen has blocked a server-side request forgery: http.request(...) originating from body.image"
      );
    }
  );
});
