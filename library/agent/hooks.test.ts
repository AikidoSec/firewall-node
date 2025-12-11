import * as t from "tap";
import {
  addHook,
  removeHook,
  executeHooks,
  OutboundRequestInfo,
} from "./hooks";

t.test("it works", async (t) => {
  let hookOneCalls = 0;
  let hookTwoCalls = 0;

  const testRequest: OutboundRequestInfo = {
    url: new URL("https://example.com"),
    port: 443,
    method: "GET",
  };

  function hook1(request: OutboundRequestInfo) {
    t.equal(request.url.href, "https://example.com/");
    t.equal(request.port, 443);
    t.equal(request.method, "GET");
    hookOneCalls++;
  }

  function hook2(request: OutboundRequestInfo) {
    t.equal(request.url.href, "https://example.com/");
    t.equal(request.port, 443);
    t.equal(request.method, "GET");
    hookTwoCalls++;
  }

  function hook3() {
    throw new Error("hook3 should not be called");
  }

  t.same(hookOneCalls, 0, "hookOneCalls starts at 0");
  t.same(hookTwoCalls, 0, "hookTwoCalls starts at 0");

  executeHooks("beforeOutboundRequest", testRequest);

  t.same(hookOneCalls, 0, "hookOneCalls still at 0");
  t.same(hookTwoCalls, 0, "hookTwoCalls still at 0");

  addHook("beforeOutboundRequest", hook1);
  // @ts-expect-error some other hook is not defined in the types
  addHook("someOtherHook", hook3);
  executeHooks("beforeOutboundRequest", testRequest);

  t.equal(hookOneCalls, 1, "hook1 called once");
  t.equal(hookTwoCalls, 0, "hook2 not called");

  addHook("beforeOutboundRequest", hook2);
  executeHooks("beforeOutboundRequest", testRequest);

  t.equal(hookOneCalls, 2, "hook1 called twice");
  t.equal(hookTwoCalls, 1, "hook2 called once");

  removeHook("beforeOutboundRequest", hook1);
  executeHooks("beforeOutboundRequest", testRequest);

  t.equal(hookOneCalls, 2, "hook1 still called twice");
  t.equal(hookTwoCalls, 2, "hook2 called twice");

  removeHook("beforeOutboundRequest", hook2);
  executeHooks("beforeOutboundRequest", testRequest);

  t.equal(hookOneCalls, 2, "hook1 still called twice");
  t.equal(hookTwoCalls, 2, "hook2 still called twice");
});

t.test("it handles errors gracefully", async (t) => {
  let successCalls = 0;

  function throwingHook() {
    throw new Error("This should be caught");
  }

  function successHook() {
    successCalls++;
  }

  const testRequest: OutboundRequestInfo = {
    url: new URL("https://example.com"),
    port: 443,
    method: "POST",
  };

  addHook("beforeOutboundRequest", throwingHook);
  addHook("beforeOutboundRequest", successHook);

  // Should not throw even though one hook throws
  executeHooks("beforeOutboundRequest", testRequest);

  t.equal(
    successCalls,
    1,
    "success hook still called despite error in other hook"
  );

  removeHook("beforeOutboundRequest", throwingHook);
  removeHook("beforeOutboundRequest", successHook);
});

t.test("it handles async hooks with rejected promises", async (t) => {
  let asyncCalls = 0;

  async function asyncHook() {
    asyncCalls++;
    throw new Error("Async error");
  }

  const testRequest: OutboundRequestInfo = {
    url: new URL("https://example.com"),
    port: 443,
    method: "DELETE",
  };

  addHook("beforeOutboundRequest", asyncHook);

  // Should not throw even though async hook rejects
  executeHooks("beforeOutboundRequest", testRequest);

  t.equal(asyncCalls, 1, "async hook was called");

  removeHook("beforeOutboundRequest", asyncHook);
});

t.test("it prevents duplicate hooks using Set", async (t) => {
  let hookCalls = 0;

  function hook() {
    hookCalls++;
  }

  const testRequest: OutboundRequestInfo = {
    url: new URL("https://example.com"),
    port: 443,
    method: "GET",
  };

  addHook("beforeOutboundRequest", hook);
  addHook("beforeOutboundRequest", hook); // Try to add the same hook again

  executeHooks("beforeOutboundRequest", testRequest);

  t.equal(hookCalls, 1, "hook only called once despite being added twice");

  removeHook("beforeOutboundRequest", hook);
});
