import * as t from "tap";
import { getUrlFromOptions } from "./getUrlFromOptions";

t.test("it works", async () => {
  t.same(
    getUrlFromOptions({
      origin: "http://localhost:3000/",
      path: "test?query=1",
    }).href,
    "http://localhost:3000/test?query=1"
  );

  t.same(
    getUrlFromOptions({
      origin: new URL("http://localhost:3000"),
      path: "test?query=1",
    }).href,
    "http://localhost:3000/test?query=1"
  );

  t.same(
    getUrlFromOptions({
      origin: new URL("http://localhost:3000"),
    }).href,
    "http://localhost:3000/"
  );
});
