import t from "tap";
import { isDebuggingSSE } from "./isDebuggingSSE";

t.test("isDebuggingSSE", async (t) => {
  t.test("returns true when AIKIDO_DEBUG_SSE is set to 'true'", (t) => {
    process.env.AIKIDO_DEBUG_SSE = "true";
    t.equal(isDebuggingSSE(), true);
    t.end();
  });

  t.test("returns false when AIKIDO_DEBUG_SSE is set to 'false'", (t) => {
    process.env.AIKIDO_DEBUG_SSE = "false";
    t.equal(isDebuggingSSE(), false);
    t.end();
  });

  t.test("returns false when AIKIDO_DEBUG_SSE is not set", (t) => {
    delete process.env.AIKIDO_DEBUG_SSE;
    t.equal(isDebuggingSSE(), false);
    t.end();
  });
});
