import * as t from "tap";
import { getIPAddressFromRequest } from "./getIPAddressFromRequest";

t.beforeEach(() => {
  delete process.env.AIKIDO_TRUST_PROXY;
});

t.test("no headers and no remote address", async (t) => {
  process.env.AIKIDO_TRUST_PROXY = "false";
  t.same(
    getIPAddressFromRequest({
      headers: {},
      remoteAddress: undefined,
    }),
    undefined
  );
  process.env.AIKIDO_TRUST_PROXY = "true";
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
  t.same(
    getIPAddressFromRequest({
      headers: {},
      remoteAddress: "1.2.3.4",
    }),
    "1.2.3.4"
  );
  process.env.AIKIDO_TRUST_PROXY = "true";
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
  t.same(
    getIPAddressFromRequest({
      headers: {
        "x-forwarded-for": "9.9.9.9:8080",
      },
      remoteAddress: "1.2.3.4",
    }),
    "9.9.9.9"
  );
});

t.test("with trailing comma", async (t) => {
  process.env.AIKIDO_TRUST_PROXY = "true";
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
  'x-forwarded-for with trust proxy and "x-forwarded-for"  contains private IP at the end',
  async (t) => {
    process.env.AIKIDO_TRUST_PROXY = "true";
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

t.test("x-forwarded-for with trust proxy and multiple IPs", async (t) => {
  process.env.AIKIDO_TRUST_PROXY = "true";
  t.same(
    getIPAddressFromRequest({
      headers: {
        "x-forwarded-for": "9.9.9.9, 8.8.8.8, 7.7.7.7",
      },
      remoteAddress: "1.2.3.4",
    }),
    "9.9.9.9"
  );
  t.same(
    getIPAddressFromRequest({
      headers: {
        "x-forwarded-for":
          "a3ad:8f95:d2a8:454b:cf19:be6e:73c6:f880, 3b07:2fba:0270:2149:5fc1:2049:5f04:2131, 791d:967e:428a:90b9:8f6f:4fcc:5d88:015d",
      },
      remoteAddress: "df89:84af:85e0:c55f:960c:341a:2cc6:734d",
    }),
    "a3ad:8f95:d2a8:454b:cf19:be6e:73c6:f880"
  );
});

t.test("x-forwarded-for with trust proxy and many IPs", async (t) => {
  process.env.AIKIDO_TRUST_PROXY = "true";
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
