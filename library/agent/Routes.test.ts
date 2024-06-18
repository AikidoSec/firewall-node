import * as t from "tap";
import { Routes } from "./Routes";

t.test("it works", async (t) => {
  const routes = new Routes(3);
  t.same(routes.asArray(), []);

  routes.addRoute("GET", "/users");
  t.same(routes.asArray(), [{ method: "GET", path: "/users", hits: 1 }]);

  routes.addRoute("GET", "/users");
  t.same(routes.asArray(), [{ method: "GET", path: "/users", hits: 2 }]);

  routes.addRoute("POST", "/users");
  t.same(
    routes.asArray(),
    [
      { method: "GET", path: "/users", hits: 2 },
      { method: "POST", path: "/users", hits: 1 },
    ],
    "Should add second route"
  );

  routes.addRoute("PUT", "/users/1");
  t.same(routes.asArray(), [
    { method: "GET", path: "/users", hits: 2 },
    { method: "POST", path: "/users", hits: 1 },
    { method: "PUT", path: "/users/1", hits: 1 },
  ]);

  routes.addRoute("DELETE", "/users/1");
  t.same(routes.asArray(), [
    { method: "GET", path: "/users", hits: 2 },
    { method: "PUT", path: "/users/1", hits: 1 },
    { method: "DELETE", path: "/users/1", hits: 1 },
  ]);
});
