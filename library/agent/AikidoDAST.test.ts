import * as t from "tap";
import { isAikidoDASTRequest } from "./AikidoDAST";
import type { Context } from "./Context";

function createContext(headers: unknown): Context {
  return {
    remoteAddress: "1.2.3.4",
    method: "GET",
    url: "http://acme.com",
    query: {},
    headers: headers as Record<string, string | string[] | undefined>,
    body: undefined,
    cookies: {},
    routeParams: {},
    source: "express",
    route: "/",
    user: undefined,
  };
}

t.test("no headers returns false", async (t) => {
  const headers = {};
  t.same(isAikidoDASTRequest(createContext(headers)), false);
});

t.test("no aikido header returns false", async (t) => {
  const headers = { "x-foo": "bar" };
  t.same(isAikidoDASTRequest(createContext(headers)), false);
});

t.test("aikido header with wrong value returns false", async (t) => {
  const headers = { "aikido-api-test": "0" };
  t.same(isAikidoDASTRequest(createContext(headers)), false);
});

t.test("aikido header with correct value returns true", async (t) => {
  const headers = { "aikido-api-test": "1" };
  t.same(isAikidoDASTRequest(createContext(headers)), true);
});

t.test("headers is not an object returns false", async (t) => {
  const headers = "foo";
  t.same(isAikidoDASTRequest(createContext(headers)), false);
});
