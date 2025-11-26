import * as t from "tap";
import { wrap } from "../helpers/wrap";
import { addRouteParam, getRegisteredRouteParams } from "./addRouteParam";

let logs: string[] = [];
wrap(console, "warn", function warn() {
  return function warn(message: string) {
    logs.push(message);
  };
});

t.beforeEach(() => {
  logs = [];
});

t.test("it warns if slash is included", async (t) => {
  addRouteParam("prefix/{digits}");
  t.same(logs[0], "addRouteParam(...) expects a pattern without slashes.");
});

t.test("it warns if no curly braces are included", async (t) => {
  addRouteParam("prefix-digits");
  t.same(
    logs[0],
    "addRouteParam(...) expects a pattern that includes {digits} or {alpha}."
  );
});

t.test("addRouteParam adds valid patterns", async (t) => {
  addRouteParam("prefix-{digits}");
  t.same(getRegisteredRouteParams().length, 1);
  t.same(getRegisteredRouteParams()[0].test("prefix-12345"), true);

  addRouteParam("prefix-{digits}");
  t.same(getRegisteredRouteParams().length, 1);

  addRouteParam("prefix-{alpha}");
  t.same(getRegisteredRouteParams().length, 2);
  t.same(getRegisteredRouteParams()[1].test("prefix-abcde"), true);

  addRouteParam("prefix-{alpha}");
  t.same(getRegisteredRouteParams().length, 2);
});
