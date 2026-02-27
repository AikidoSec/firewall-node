import * as t from "tap";
import { getRouteForAiStats } from "./getRouteForAiStats";
import { runWithContext } from "../agent/Context";

const getTestContext = () => ({
  url: "/test/route",
  method: "GET",
  route: "/test/route",
  query: {},
  body: undefined,
  headers: {},
  routeParams: {},
  remoteAddress: "1.2.3.4",
  source: "test",
  cookies: {},
});

t.test("it works", async (t) => {
  t.same(getRouteForAiStats(), undefined);

  runWithContext(getTestContext(), () => {
    t.same(getRouteForAiStats(), { path: "/test/route", method: "GET" });
  });

  runWithContext(
    { ...getTestContext(), route: undefined, method: undefined },
    () => {
      t.same(getRouteForAiStats(), undefined);
    }
  );
});
