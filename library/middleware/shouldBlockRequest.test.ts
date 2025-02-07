import * as t from "tap";
import { shouldBlockRequest } from "./shouldBlockRequest";
import { runWithContext, type Context } from "../agent/Context";
import { createTestAgent } from "../helpers/createTestAgent";

const sampleContext: Context = {
  remoteAddress: "::1",
  method: "POST",
  url: "http://localhost:4000",
  query: {
    abc: "def",
  },
  headers: {},
  body: undefined,
  cookies: {},
  routeParams: {},
  source: "express",
  route: "/posts/:id",
};

t.test("without context", async (t) => {
  t.same(shouldBlockRequest(), { block: false });
});

t.test("without agent", async (t) => {
  runWithContext(sampleContext, () => {
    t.same(shouldBlockRequest(), { block: false });
  });
});

t.test("with agent", async (t) => {
  createTestAgent();
  runWithContext(sampleContext, () => {
    t.same(shouldBlockRequest(), { block: false });
  });
});
