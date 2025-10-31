import * as t from "tap";
import { Context } from "../agent/Context";
import { getSourceForUserString } from "./getSourceForUserString";

function createContext(): Context {
  return {
    remoteAddress: "::1",
    method: "POST",
    url: "http://local.aikido.io",
    query: {},
    headers: {},
    body: {
      image: "http://localhost:4000/api/internal",
    },
    cookies: {},
    routeParams: {},
    source: "express",
    route: "/posts/:id",
  };
}

t.test(
  "it returns undefined if the user string cannot be found in the context",
  async () => {
    t.same(getSourceForUserString(createContext(), "unknown"), undefined);
  }
);

t.test(
  "it returns source if the user string is found in the context",
  async () => {
    t.same(
      getSourceForUserString(
        createContext(),
        "http://localhost:4000/api/internal"
      ),
      "body"
    );
  }
);
