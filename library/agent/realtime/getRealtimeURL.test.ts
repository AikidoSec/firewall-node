import * as t from "tap";
import { getRealtimeURL } from "./getRealtimeURL";

t.afterEach(() => {
  delete process.env.AIKIDO_TOKEN;
  delete process.env.AIKIDO_REALTIME_ENDPOINT;
});

t.test("should return EU if no token set", async (t) => {
  delete process.env.AIKIDO_TOKEN;
  t.equal(getRealtimeURL().href, "https://runtime.aikido.dev/");
});

t.test("should return EU for invalid token", async (t) => {
  process.env.AIKIDO_TOKEN = "invalid-token";
  t.equal(getRealtimeURL().href, "https://runtime.aikido.dev/");
});

t.test("should return EU for old format token without region", async (t) => {
  process.env.AIKIDO_TOKEN = "AIK_RUNTIME_123_456_randomstring";
  t.equal(getRealtimeURL().href, "https://runtime.aikido.dev/");
});

t.test("should return US for new format token with US region", async (t) => {
  process.env.AIKIDO_TOKEN = "AIK_RUNTIME_123_456_US_randomstring";
  t.equal(getRealtimeURL().href, "https://runtime.us.aikido.dev/");
});

t.test("should return ME for new format token with ME region", async (t) => {
  process.env.AIKIDO_TOKEN = "AIK_RUNTIME_123_456_ME_randomstring";
  t.equal(getRealtimeURL().href, "https://runtime.me.aikido.dev/");
});

t.test("should return EU for new format token with EU region", async (t) => {
  process.env.AIKIDO_TOKEN = "AIK_RUNTIME_123_456_EU_randomstring";
  t.equal(getRealtimeURL().href, "https://runtime.aikido.dev/");
});

t.test("should not return unsupported region", async (t) => {
  process.env.AIKIDO_TOKEN = "AIK_RUNTIME_123_456_INVALID_randomstring";
  t.equal(getRealtimeURL().href, "https://runtime.aikido.dev/");
});

t.test("should respect AIKIDO_REALTIME_ENDPOINT if set", async (t) => {
  process.env.AIKIDO_REALTIME_ENDPOINT = "https://custom-runtime.example.com";
  t.equal(getRealtimeURL().href, "https://custom-runtime.example.com/");
});
