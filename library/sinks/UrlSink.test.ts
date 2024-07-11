import * as t from "tap";
import { Agent } from "../agent/Agent";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import { Context, runWithContext } from "../agent/Context";
import { LoggerNoop } from "../agent/logger/LoggerNoop";
import { UrlSink } from "./UrlSink";

const unsafeContext: Context = {
  remoteAddress: "::1",
  method: "POST",
  url: "http://localhost:4000",
  query: {},
  headers: {},
  body: {
    file: {
      matches: "../test.txt",
    },
  },
  cookies: {},
  routeParams: {},
  source: "express",
  route: "/posts/:id",
};

function throws(fn: () => void, wanted: string | RegExp) {
  const error = t.throws(fn);
  if (error instanceof Error) {
    t.match(error.message, wanted);
  }
}

t.test("it works", async (t) => {
  const agent = new Agent(
    true,
    new LoggerNoop(),
    new ReportingAPIForTesting(),
    undefined,
    "lambda"
  );

  agent.start([new UrlSink()]);

  t.match(new URL("http://localhost:4000"), {
    href: "http://localhost:4000/",
    origin: "http://localhost:4000",
    protocol: "http:",
    username: "",
    password: "",
    host: "localhost:4000",
    hostname: "localhost",
    port: "4000",
    pathname: "/",
    search: "",
    searchParams: new URLSearchParams(""),
    hash: "",
  });

  runWithContext(unsafeContext, () => {
    t.match(new URL("http://example.com/test?query=1"), {
      href: "http://example.com/test?query=1",
      origin: "http://example.com",
      protocol: "http:",
      username: "",
      password: "",
      host: "example.com",
      hostname: "example.com",
      port: "",
      pathname: "/test",
      search: "?query=1",
      searchParams: new URLSearchParams("query=1"),
      hash: "",
    });

    t.match(new URL("file:///test.txt"), {
      href: "file:///test.txt",
      origin: "null",
      protocol: "file:",
      username: "",
      password: "",
      host: "",
      hostname: "",
      port: "",
      pathname: "/test.txt",
      search: "",
      searchParams: new URLSearchParams(""),
      hash: "",
    });

    throws(
      () => new URL("file:///../test.txt"),
      /Aikido firewall has blocked a path traversal attack: new URL.* originating from body.file.matches/
    );

    throws(
      () => new URL(new URL("file:///../test.txt")),
      /Aikido firewall has blocked a path traversal attack: new URL.* originating from body.file.matches/
    );
  });
});
