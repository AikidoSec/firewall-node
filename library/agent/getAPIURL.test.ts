import * as t from "tap";
import { getAPIURL } from "./getAPIURL";

t.afterEach(() => {
  delete process.env.AIKIDO_TOKEN;
  delete process.env.AIKIDO_ENDPOINT;
});

t.test("should return EU if no token set", async (t) => {
  delete process.env.AIKIDO_TOKEN;
  t.equal(getAPIURL().href, "https://guard.aikido.dev/");
});

t.test("should return EU for invalid token", async (t) => {
  process.env.AIKIDO_TOKEN = "invalid-token";
  t.equal(getAPIURL().href, "https://guard.aikido.dev/");
});

t.test("should return EU for old format token without region", async (t) => {
  process.env.AIKIDO_TOKEN = "AIK_RUNTIME_123_456_randomstring";
  t.equal(getAPIURL().href, "https://guard.aikido.dev/");
});

t.test("should return US for new format token with US region", async (t) => {
  process.env.AIKIDO_TOKEN = "AIK_RUNTIME_123_456_US_randomstring";
  t.equal(getAPIURL().href, "https://guard.us.aikido.dev/");
});

t.test("should return ME for new format token with ME region", async (t) => {
  process.env.AIKIDO_TOKEN = "AIK_RUNTIME_123_456_ME_randomstring";
  t.equal(getAPIURL().href, "https://guard.me.aikido.dev/");
});

t.test("should return EU for new format token with EU region", async (t) => {
  process.env.AIKIDO_TOKEN = "AIK_RUNTIME_123_456_EU_randomstring";
  t.equal(getAPIURL().href, "https://guard.aikido.dev/");
});

t.test("should not return unsupported region", async (t) => {
  process.env.AIKIDO_TOKEN = "AIK_RUNTIME_123_456_INVALID_randomstring";
  t.equal(getAPIURL().href, "https://guard.aikido.dev/");
});

t.test("should respect AIKIDO_ENDPOINT if set", async (t) => {
  process.env.AIKIDO_ENDPOINT = "https://custom-endpoint.example.com";
  t.equal(getAPIURL().href, "https://custom-endpoint.example.com/");
});
