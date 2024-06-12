import * as t from "tap";
import { routeExists } from "./routeExists";

t.test("it works", async () => {
  t.same(routeExists(404), false);
  t.same(routeExists(405), false);
  t.same(routeExists(200), true);
  t.same(routeExists(500), true);
  t.same(routeExists(400), true);
  t.same(routeExists(300), true);
  t.same(routeExists(201), true);
});
