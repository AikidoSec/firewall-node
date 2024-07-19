import * as t from "tap";
import { Routes } from "./Routes";

t.test("it works", async (t) => {
  const routes = new Routes(3);
  t.same(routes.asArray(), []);

  routes.addRoute("GET", "/users");
  t.same(routes.asArray(), [
    { method: "GET", path: "/users", hits: 1, graphql: undefined },
  ]);

  routes.addRoute("GET", "/users");
  t.same(routes.asArray(), [
    { method: "GET", path: "/users", hits: 2, graphql: undefined },
  ]);

  routes.addRoute("POST", "/users");
  t.same(
    routes.asArray(),
    [
      { method: "GET", path: "/users", hits: 2, graphql: undefined },
      { method: "POST", path: "/users", hits: 1, graphql: undefined },
    ],
    "Should add second route"
  );

  routes.addRoute("PUT", "/users/1");
  t.same(routes.asArray(), [
    { method: "GET", path: "/users", hits: 2, graphql: undefined },
    { method: "POST", path: "/users", hits: 1, graphql: undefined },
    { method: "PUT", path: "/users/1", hits: 1, graphql: undefined },
  ]);

  routes.addRoute("DELETE", "/users/1");
  t.same(routes.asArray(), [
    { method: "GET", path: "/users", hits: 2, graphql: undefined },
    { method: "PUT", path: "/users/1", hits: 1, graphql: undefined },
    { method: "DELETE", path: "/users/1", hits: 1, graphql: undefined },
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
      graphql: undefined,
    },
    {
      method: "POST",
      path: "/graphql",
      hits: 1,
      graphql: { type: "query", name: "user" },
    },
  ]);

  routes.addGraphQLField("POST", "/graphql", "query", "user");
  t.same(routes.asArray(), [
    {
      method: "POST",
      path: "/graphql",
      hits: 1,
      graphql: undefined,
    },
    {
      method: "POST",
      path: "/graphql",
      hits: 2,
      graphql: { type: "query", name: "user" },
    },
  ]);

  routes.addGraphQLField("POST", "/graphql", "query", "post");
  t.same(routes.asArray(), [
    {
      method: "POST",
      path: "/graphql",
      hits: 1,
      graphql: undefined,
    },
    {
      method: "POST",
      path: "/graphql",
      hits: 2,
      graphql: { type: "query", name: "user" },
    },
    {
      method: "POST",
      path: "/graphql",
      hits: 1,
      graphql: {
        type: "query",
        name: "post",
      },
    },
  ]);

  routes.addGraphQLField("POST", "/graphql", "mutation", "post");
  t.same(routes.asArray(), [
    {
      method: "POST",
      path: "/graphql",
      hits: 1,
      graphql: undefined,
    },
    {
      method: "POST",
      path: "/graphql",
      hits: 2,
      graphql: { type: "query", name: "user" },
    },
    {
      method: "POST",
      path: "/graphql",
      hits: 1,
      graphql: {
        type: "query",
        name: "post",
      },
    },
    {
      method: "POST",
      path: "/graphql",
      hits: 1,
      graphql: {
        type: "mutation",
        name: "post",
      },
    },
  ]);
});
