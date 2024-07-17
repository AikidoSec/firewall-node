import * as t from "tap";
import { Routes } from "./Routes";

t.test("it works", async (t) => {
  const routes = new Routes(3);
  t.same(routes.asArray(), []);

  routes.addRoute("GET", "/users");
  t.same(routes.asArray(), [
    { method: "GET", path: "/users", hits: 1, graphql: { fields: [] } },
  ]);

  routes.addRoute("GET", "/users");
  t.same(routes.asArray(), [
    { method: "GET", path: "/users", hits: 2, graphql: { fields: [] } },
  ]);

  routes.addRoute("POST", "/users");
  t.same(
    routes.asArray(),
    [
      { method: "GET", path: "/users", hits: 2, graphql: { fields: [] } },
      { method: "POST", path: "/users", hits: 1, graphql: { fields: [] } },
    ],
    "Should add second route"
  );

  routes.addRoute("PUT", "/users/1");
  t.same(routes.asArray(), [
    { method: "GET", path: "/users", hits: 2, graphql: { fields: [] } },
    { method: "POST", path: "/users", hits: 1, graphql: { fields: [] } },
    { method: "PUT", path: "/users/1", hits: 1, graphql: { fields: [] } },
  ]);

  routes.addRoute("DELETE", "/users/1");
  t.same(routes.asArray(), [
    { method: "GET", path: "/users", hits: 2, graphql: { fields: [] } },
    { method: "PUT", path: "/users/1", hits: 1, graphql: { fields: [] } },
    { method: "DELETE", path: "/users/1", hits: 1, graphql: { fields: [] } },
  ]);

  routes.clear();
  t.same(routes.asArray(), []);
});

t.test("it adds GraphQL fields", async (t) => {
  const routes = new Routes(3);
  routes.addRoute("POST", "/graphql");
  routes.addGraphQLField("POST", "/graphql", "query", "user");
  t.same(routes.asArray(), [
    {
      method: "POST",
      path: "/graphql",
      hits: 1,
      graphql: { fields: [{ type: "query", name: "user" }] },
    },
  ]);

  routes.addGraphQLField("POST", "/graphql", "query", "user");
  t.same(routes.asArray(), [
    {
      method: "POST",
      path: "/graphql",
      hits: 1,
      graphql: { fields: [{ type: "query", name: "user" }] },
    },
  ]);

  routes.addGraphQLField("POST", "/graphql", "query", "post");
  t.same(routes.asArray(), [
    {
      method: "POST",
      path: "/graphql",
      hits: 1,
      graphql: {
        fields: [
          { type: "query", name: "user" },
          { type: "query", name: "post" },
        ],
      },
    },
  ]);

  routes.addGraphQLField("POST", "/graphql", "mutation", "post");
  t.same(routes.asArray(), [
    {
      method: "POST",
      path: "/graphql",
      hits: 1,
      graphql: {
        fields: [
          { type: "query", name: "user" },
          { type: "query", name: "post" },
          { type: "mutation", name: "post" },
        ],
      },
    },
  ]);
});
