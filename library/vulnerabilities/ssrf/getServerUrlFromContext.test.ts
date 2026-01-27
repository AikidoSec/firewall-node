import * as t from "tap";
import { getServerUrlFromContext } from "./getServerUrlFromContext";
import { Context } from "../../agent/Context";

function createContext(
  url: string | undefined,
  headers: Record<string, string> = {}
): Context {
  return {
    url: url,
    method: "GET",
    headers: headers,
    query: {},
    route: "/",
    source: "test",
    routeParams: {},
    cookies: {},
    body: undefined,
    remoteAddress: "127.0.0.1",
  };
}

t.test("returns undefined if context.url is undefined", async (t) => {
  t.equal(getServerUrlFromContext(createContext(undefined)), undefined);
});

t.test("returns full URL as-is if already absolute", async (t) => {
  t.equal(
    getServerUrlFromContext(
      createContext("http://192.168.1.50:3000/", {
        host: "192.168.1.50:3000",
      })
    ),
    "http://192.168.1.50:3000/"
  );
  t.equal(
    getServerUrlFromContext(
      createContext("https://example.com/path", { host: "example.com" })
    ),
    "https://example.com/path"
  );
});

t.test(
  "builds full URL from Host header when context.url is just a path",
  async (t) => {
    t.equal(
      getServerUrlFromContext(
        createContext("/", { host: "192.168.1.50:3000" })
      ),
      "http://192.168.1.50:3000/"
    );
    t.equal(
      getServerUrlFromContext(
        createContext("/api/users", { host: "192.168.1.1:8080" })
      ),
      "http://192.168.1.1:8080/api/users"
    );
  }
);

t.test(
  "returns undefined if context.url is a path and no Host header",
  async (t) => {
    t.equal(getServerUrlFromContext(createContext("/")), undefined);
    t.equal(
      getServerUrlFromContext(createContext("/", { host: "" })),
      undefined
    );
  }
);

t.test("uses Host header and ignores x-forwarded-host", async (t) => {
  // We intentionally use the Host header (not x-forwarded-host) because we
  // need the actual internal server address for self-request detection.
  t.equal(
    getServerUrlFromContext(
      createContext("/", {
        host: "192.168.1.50:3000",
        "x-forwarded-host": "app.example.com",
      })
    ),
    "http://192.168.1.50:3000/"
  );
});
