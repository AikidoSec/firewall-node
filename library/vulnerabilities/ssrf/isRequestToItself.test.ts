import * as t from "tap";
import { isRequestToItself } from "./isRequestToItself";

t.test("it returns true for a request to itself", async (t) => {
  t.same(
    isRequestToItself({
      source: "headers",
      path: ".host",
      port: 1234,
      str: "localhost:1234",
    }),
    true
  );
  t.same(
    isRequestToItself({
      source: "headers",
      path: ".origin",
      port: 1234,
      str: "http://localhost:1234",
    }),
    true
  );
  t.same(
    isRequestToItself({
      source: "headers",
      path: ".referer",
      port: 1234,
      str: "http://localhost:1234",
    }),
    true
  );
});

t.test("it returns false", async (t) => {
  t.same(
    isRequestToItself({
      source: "headers",
      path: ".host",
      port: 1234,
      str: "localhost:1235",
    }),
    false
  );
  t.same(
    isRequestToItself({
      source: "headers",
      path: ".host",
      port: 1234,
      str: "localhostabc:1234",
    }),
    false
  );
  t.same(
    isRequestToItself({
      source: "headers",
      path: ".hostabc",
      port: 1234,
      str: "localhost:1234",
    }),
    false
  );
  t.same(
    isRequestToItself({
      // @ts-expect-error Testing
      source: "headersabc",
      path: ".host",
      port: 1234,
      str: "localhost:1234",
    }),
    false
  );
  t.same(
    isRequestToItself({
      source: "headers",
      path: ".host",
      port: 1234,
      str: "http://localhost:1234",
    }),
    false
  );
  t.same(
    isRequestToItself({
      source: "headers",
      path: ".origin",
      port: 1234,
      str: "http%%%://localhost:1234",
    }),
    false
  );
});
