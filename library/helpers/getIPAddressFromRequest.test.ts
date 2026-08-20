import * as t from "tap";
import { getIPAddressFromRequest } from "./getIPAddressFromRequest";
import { clearTrustProxyCache } from "./trustProxy";

t.beforeEach(() => {
  delete process.env.AIKIDO_TRUST_PROXY;
  delete process.env.AIKIDO_CLIENT_IP_HEADER;
  clearTrustProxyCache();
});

t.test("no headers and no remote address", async (t) => {
  process.env.AIKIDO_TRUST_PROXY = "false";
  clearTrustProxyCache();
  t.same(
    getIPAddressFromRequest({
      headers: {},
      remoteAddress: undefined,
    }),
    undefined
  );
  clearTrustProxyCache();
  process.env.AIKIDO_TRUST_PROXY = "true";
  clearTrustProxyCache();
  t.same(
    getIPAddressFromRequest({
      headers: {},
      remoteAddress: undefined,
    }),
    undefined
  );
});

t.test("no headers and remote address", async (t) => {
  process.env.AIKIDO_TRUST_PROXY = "false";
  clearTrustProxyCache();
  t.same(
    getIPAddressFromRequest({
      headers: {},
      remoteAddress: "1.2.3.4",
    }),
    "1.2.3.4"
  );
  process.env.AIKIDO_TRUST_PROXY = "true";
  clearTrustProxyCache();
  t.same(
    getIPAddressFromRequest({
      headers: {},
      remoteAddress: "1.2.3.4",
    }),
    "1.2.3.4"
  );
});

t.test("x-forwarded-for without trust proxy", async (t) => {
  process.env.AIKIDO_TRUST_PROXY = "false";
  clearTrustProxyCache();
  t.same(
    getIPAddressFromRequest({
      headers: {
        "x-forwarded-for": "9.9.9.9",
      },
      remoteAddress: "1.2.3.4",
    }),
    "1.2.3.4"
  );
  t.same(
    getIPAddressFromRequest({
      headers: {
        "x-forwarded-for": "a3ad:8f95:d2a8:454b:cf19:be6e:73c6:f880",
      },
      remoteAddress: "df89:84af:85e0:c55f:960c:341a:2cc6:734d",
    }),
    "df89:84af:85e0:c55f:960c:341a:2cc6:734d"
  );
});

t.test(
  'x-forwarded-for with trust proxy and "x-forwarded-for" is not an IP',
  async (t) => {
    process.env.AIKIDO_TRUST_PROXY = "true";
    clearTrustProxyCache();
    t.same(
      getIPAddressFromRequest({
        headers: {
          "x-forwarded-for": "invalid",
        },
        remoteAddress: "1.2.3.4",
      }),
      "1.2.3.4"
    );
  }
);

t.test("x-forwarded-for with trust proxy and IP contains port", async (t) => {
  process.env.AIKIDO_TRUST_PROXY = "true";
  clearTrustProxyCache();
  t.same(
    getIPAddressFromRequest({
      headers: {
        "x-forwarded-for": "9.9.9.9:8080",
      },
      remoteAddress: "1.2.3.4",
    }),
    "9.9.9.9"
  );
  t.same(
    getIPAddressFromRequest({
      headers: {
        "x-forwarded-for": "[a3ad:8f95:d2a8:454b:cf19:be6e:73c6:f880]:8080",
      },
      remoteAddress: "1.2.3.4",
    }),
    "a3ad:8f95:d2a8:454b:cf19:be6e:73c6:f880"
  );
  t.same(
    getIPAddressFromRequest({
      headers: {
        "x-forwarded-for": "[a3ad:8f95:d2a8:454b:cf19:be6e:73c6:f880]",
      },
      remoteAddress: "1.2.3.4",
    }),
    "a3ad:8f95:d2a8:454b:cf19:be6e:73c6:f880"
  );
  // Invalid format
  t.same(
    getIPAddressFromRequest({
      headers: {
        "x-forwarded-for": "a3ad:8f95:d2a8:454b:cf19:be6e:73c6:f880:8080",
      },
      remoteAddress: "df89:84af:85e0:c55f:960c:341a:2cc6:734d",
    }),
    "df89:84af:85e0:c55f:960c:341a:2cc6:734d"
  );
});

t.test("with trailing comma", async (t) => {
  process.env.AIKIDO_TRUST_PROXY = "true";
  clearTrustProxyCache();
  t.same(
    getIPAddressFromRequest({
      headers: {
        "x-forwarded-for": "9.9.9.9,",
      },
      remoteAddress: "1.2.3.4",
    }),
    "9.9.9.9"
  );
  t.same(
    getIPAddressFromRequest({
      headers: {
        "x-forwarded-for": ",9.9.9.9",
      },
      remoteAddress: "1.2.3.4",
    }),
    "9.9.9.9"
  );
  t.same(
    getIPAddressFromRequest({
      headers: {
        "x-forwarded-for": ",9.9.9.9,",
      },
      remoteAddress: "1.2.3.4",
    }),
    "9.9.9.9"
  );
  t.same(
    getIPAddressFromRequest({
      headers: {
        "x-forwarded-for": ",9.9.9.9,,",
      },
      remoteAddress: "1.2.3.4",
    }),
    "9.9.9.9"
  );
});

t.test(
  'x-forwarded-for with trust proxy and "x-forwarded-for" is a private IP',
  async (t) => {
    process.env.AIKIDO_TRUST_PROXY = "true";
    clearTrustProxyCache();
    t.same(
      getIPAddressFromRequest({
        headers: {
          "x-forwarded-for": "127.0.0.1",
        },
        remoteAddress: "1.2.3.4",
      }),
      "1.2.3.4"
    );
    t.same(
      getIPAddressFromRequest({
        headers: {
          "x-forwarded-for": "::1",
        },
        remoteAddress: "df89:84af:85e0:c55f:960c:341a:2cc6:734d",
      }),
      "df89:84af:85e0:c55f:960c:341a:2cc6:734d"
    );
  }
);

t.test(
  'x-forwarded-for with trust proxy and "x-forwarded-for" contains private IP',
  async (t) => {
    process.env.AIKIDO_TRUST_PROXY = "true";
    clearTrustProxyCache();
    t.same(
      getIPAddressFromRequest({
        headers: {
          "x-forwarded-for": "127.0.0.1, 9.9.9.9",
        },
        remoteAddress: "1.2.3.4",
      }),
      "9.9.9.9"
    );
    t.same(
      getIPAddressFromRequest({
        headers: {
          "x-forwarded-for": "::1, a3ad:8f95:d2a8:454b:cf19:be6e:73c6:f880",
        },
        remoteAddress: "df89:84af:85e0:c55f:960c:341a:2cc6:734d",
      }),
      "a3ad:8f95:d2a8:454b:cf19:be6e:73c6:f880"
    );
  }
);

t.test(
  'x-forwarded-for with trust proxy and "x-forwarded-for" is public IP',
  async (t) => {
    process.env.AIKIDO_TRUST_PROXY = "true";
    clearTrustProxyCache();
    t.same(
      getIPAddressFromRequest({
        headers: {
          "x-forwarded-for": "9.9.9.9",
        },
        remoteAddress: "1.2.3.4",
      }),
      "9.9.9.9"
    );
    t.same(
      getIPAddressFromRequest({
        headers: {
          "x-forwarded-for": "a3ad:8f95:d2a8:454b:cf19:be6e:73c6:f880",
        },
        remoteAddress: "df89:84af:85e0:c55f:960c:341a:2cc6:734d",
      }),
      "a3ad:8f95:d2a8:454b:cf19:be6e:73c6:f880"
    );
  }
);

t.test(
  'x-forwarded-for with trust proxy and "x-forwarded-for" contains private IP at the end',
  async (t) => {
    process.env.AIKIDO_TRUST_PROXY = "true";
    clearTrustProxyCache();
    // Rightmost non-private: 9.9.9.9
    t.same(
      getIPAddressFromRequest({
        headers: {
          "x-forwarded-for": "9.9.9.9, 127.0.0.1",
        },
        remoteAddress: "1.2.3.4",
      }),
      "9.9.9.9"
    );
    t.same(
      getIPAddressFromRequest({
        headers: {
          "x-forwarded-for": "a3ad:8f95:d2a8:454b:cf19:be6e:73c6:f880, ::1",
        },
        remoteAddress: "df89:84af:85e0:c55f:960c:341a:2cc6:734d",
      }),
      "a3ad:8f95:d2a8:454b:cf19:be6e:73c6:f880"
    );
  }
);

t.test(
  "x-forwarded-for with trust proxy and multiple public IPs returns rightmost",
  async (t) => {
    process.env.AIKIDO_TRUST_PROXY = "true";
    clearTrustProxyCache();
    // Rightmost non-private is 7.7.7.7
    t.same(
      getIPAddressFromRequest({
        headers: {
          "x-forwarded-for": "9.9.9.9, 8.8.8.8, 7.7.7.7",
        },
        remoteAddress: "1.2.3.4",
      }),
      "7.7.7.7"
    );
    t.same(
      getIPAddressFromRequest({
        headers: {
          "x-forwarded-for":
            "a3ad:8f95:d2a8:454b:cf19:be6e:73c6:f880, 3b07:2fba:0270:2149:5fc1:2049:5f04:2131, 791d:967e:428a:90b9:8f6f:4fcc:5d88:015d",
        },
        remoteAddress: "df89:84af:85e0:c55f:960c:341a:2cc6:734d",
      }),
      "791d:967e:428a:90b9:8f6f:4fcc:5d88:015d"
    );
  }
);

t.test("x-forwarded-for with trust proxy and many IPs", async (t) => {
  process.env.AIKIDO_TRUST_PROXY = "true";
  clearTrustProxyCache();
  t.same(
    getIPAddressFromRequest({
      headers: {
        "x-forwarded-for": "127.0.0.1, 192.168.0.1, 192.168.0.2, 9.9.9.9",
      },
      remoteAddress: "1.2.3.4",
    }),
    "9.9.9.9"
  );
  t.same(
    getIPAddressFromRequest({
      headers: {
        "x-forwarded-for": "9.9.9.9, 127.0.0.1, 192.168.0.1, 192.168.0.2",
      },
      remoteAddress: "1.2.3.4",
    }),
    "9.9.9.9"
  );
});

t.test("get ip from different header", async (t) => {
  t.same(
    getIPAddressFromRequest({
      headers: {
        "x-forwarded-for": "127.0.0.1, 192.168.0.1",
        "connecting-ip": "9.9.9.9",
      },
      remoteAddress: "1.2.3.4",
    }),
    "1.2.3.4"
  );
  process.env.AIKIDO_CLIENT_IP_HEADER = "connecting-ip";
  t.same(
    getIPAddressFromRequest({
      headers: {
        "x-forwarded-for": "127.0.0.1, 192.168.0.1",
        "connecting-ip": "9.9.9.9",
      },
      remoteAddress: "1.2.3.4",
    }),
    "9.9.9.9"
  );
  t.same(
    getIPAddressFromRequest({
      headers: {
        "x-forwarded-for": "127.0.0.1, 192.168.0.1",
      },
      remoteAddress: "1.2.3.4",
    }),
    "1.2.3.4"
  );
  process.env.AIKIDO_CLIENT_IP_HEADER = "connecting-IP";
  t.same(
    getIPAddressFromRequest({
      headers: {
        "x-forwarded-for": "127.0.0.1, 192.168.0.1",
        "connecting-ip": "9.9.9.9",
      },
      remoteAddress: "1.2.3.4",
    }),
    "9.9.9.9"
  );
  process.env.AIKIDO_CLIENT_IP_HEADER = "";
  t.same(
    getIPAddressFromRequest({
      headers: {
        "x-forwarded-for": "127.0.0.1, 192.168.0.1",
        "connecting-ip": "9.9.9.9",
      },
      remoteAddress: "1.2.3.4",
    }),
    "1.2.3.4"
  );
  t.same(
    getIPAddressFromRequest({
      headers: {
        "x-forwarded-for": "127.0.0.1, 192.168.0.1, 5.6.7.8",
      },
      remoteAddress: "1.2.3.4",
    }),
    "5.6.7.8"
  );
});

t.test("count mode: use nth IP from the right", async (t) => {
  process.env.AIKIDO_TRUST_PROXY = "1";
  clearTrustProxyCache();
  // n=1: rightmost
  t.same(
    getIPAddressFromRequest({
      headers: { "x-forwarded-for": "9.9.9.9, 8.8.8.8, 1.2.3.4" },
      remoteAddress: "5.5.5.5",
    }),
    "1.2.3.4"
  );

  process.env.AIKIDO_TRUST_PROXY = "2";
  clearTrustProxyCache();
  // n=2: second from right
  t.same(
    getIPAddressFromRequest({
      headers: { "x-forwarded-for": "9.9.9.9, 8.8.8.8, 1.2.3.4" },
      remoteAddress: "5.5.5.5",
    }),
    "8.8.8.8"
  );

  process.env.AIKIDO_TRUST_PROXY = "3";
  clearTrustProxyCache();
  // n=3: third from right
  t.same(
    getIPAddressFromRequest({
      headers: { "x-forwarded-for": "9.9.9.9, 8.8.8.8, 1.2.3.4" },
      remoteAddress: "5.5.5.5",
    }),
    "9.9.9.9"
  );

  process.env.AIKIDO_TRUST_PROXY = "10";
  clearTrustProxyCache();
  // n exceeds header length: fall back to remoteAddress
  t.same(
    getIPAddressFromRequest({
      headers: { "x-forwarded-for": "9.9.9.9, 8.8.8.8" },
      remoteAddress: "5.5.5.5",
    }),
    "5.5.5.5"
  );
});

t.test(
  "count mode: private IP at the selected slot falls back to remoteAddress",
  async (t) => {
    process.env.AIKIDO_TRUST_PROXY = "1";
    clearTrustProxyCache();
    // n=1 selects rightmost (127.0.0.1), which is private → fall back
    t.same(
      getIPAddressFromRequest({
        headers: { "x-forwarded-for": "9.9.9.9, 127.0.0.1" },
        remoteAddress: "5.5.5.5",
      }),
      "5.5.5.5"
    );
  }
);

t.test("CIDR mode: skip IPs in trusted proxy ranges", async (t) => {
  process.env.AIKIDO_TRUST_PROXY = "1.2.3.4/32";
  clearTrustProxyCache();
  t.same(
    getIPAddressFromRequest({
      headers: { "x-forwarded-for": "9.9.9.9, 1.2.3.4" },
      remoteAddress: "1.2.3.4",
    }),
    "9.9.9.9"
  );
});

t.test(
  "CIDR mode: multiple ranges, rightmost non-proxy non-private IP",
  async (t) => {
    process.env.AIKIDO_TRUST_PROXY = "1.2.3.4/32, 5.6.7.0/24";
    clearTrustProxyCache();
    t.same(
      getIPAddressFromRequest({
        headers: { "x-forwarded-for": "9.9.9.9, 5.6.7.8, 1.2.3.4" },
        remoteAddress: "1.2.3.4",
      }),
      "9.9.9.9"
    );
  }
);

t.test(
  "CIDR mode: all IPs in trusted range, fall back to remoteAddress",
  async (t) => {
    process.env.AIKIDO_TRUST_PROXY = "9.9.9.0/24";
    clearTrustProxyCache();
    t.same(
      getIPAddressFromRequest({
        headers: { "x-forwarded-for": "9.9.9.1, 9.9.9.2" },
        remoteAddress: "1.2.3.4",
      }),
      "1.2.3.4"
    );
  }
);

t.test("CIDR mode: still skips private IPs even if not in CIDR", async (t) => {
  process.env.AIKIDO_TRUST_PROXY = "1.2.3.4/32";
  clearTrustProxyCache();
  t.same(
    getIPAddressFromRequest({
      headers: { "x-forwarded-for": "8.8.8.8, 192.168.1.1, 1.2.3.4" },
      remoteAddress: "5.5.5.5",
    }),
    "8.8.8.8"
  );
});
