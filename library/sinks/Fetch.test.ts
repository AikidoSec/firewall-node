/* eslint-disable prefer-rest-params */
import * as t from "tap";
import { Agent } from "../agent/Agent";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import { Context, runWithContext } from "../agent/Context";
import { LoggerNoop } from "../agent/logger/LoggerNoop";
import { wrap } from "../helpers/wrap";
import { Fetch } from "./Fetch";
import * as dns from "dns";

wrap(dns, "lookup", function lookup(original) {
  return function lookup() {
    if (arguments[0] === "thisdomainpointstointernalip.com") {
      return original.apply(this, [
        "localhost",
        ...Array.from(arguments).slice(1),
      ]);
    }

    original.apply(this, arguments);
  };
});

const context: Context = {
  remoteAddress: "::1",
  method: "POST",
  url: "http://localhost:4000",
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

t.test(
  "it works",
  { skip: !global.fetch ? "fetch is not available" : false },
  async (t) => {
    const agent = new Agent(
      true,
      new LoggerNoop(),
      new ReportingAPIForTesting(),
      undefined,
      undefined
    );
    agent.start([new Fetch()]);

    t.same(agent.getHostnames().asArray(), []);

    await fetch("http://aikido.dev");

    t.same(agent.getHostnames().asArray(), [
      { hostname: "aikido.dev", port: 80 },
    ]);
    agent.getHostnames().clear();

    await fetch(new URL("https://aikido.dev"));

    t.same(agent.getHostnames().asArray(), [
      { hostname: "aikido.dev", port: 443 },
    ]);
    agent.getHostnames().clear();

    await t.rejects(() => fetch(""));
    await t.rejects(() => fetch("invalid url"));

    t.same(agent.getHostnames().asArray(), []);
    agent.getHostnames().clear();

    await runWithContext(context, async () => {
      await fetch("https://google.com");
      const error = await t.rejects(() =>
        fetch("http://localhost:4000/api/internal")
      );
      if (error instanceof Error) {
        t.same(
          error.message,
          "Aikido firewall has blocked a server-side request forgery: fetch(...) originating from body.image"
        );
      }

      const error2 = await t.rejects(() =>
        fetch(new URL("http://localhost:4000/api/internal"))
      );
      if (error2 instanceof Error) {
        t.same(
          error2.message,
          "Aikido firewall has blocked a server-side request forgery: fetch(...) originating from body.image"
        );
      }
    });

    await runWithContext(
      {
        ...context,
        ...{ body: { image: "http://thisdomainpointstointernalip.com" } },
      },
      async () => {
        const error = await t.rejects(() =>
          fetch("http://thisdomainpointstointernalip.com")
        );
        if (error instanceof Error) {
          t.same(
            // @ts-expect-error Type is not defined
            error.cause.message,
            "Aikido firewall has blocked a server-side request forgery: fetch(...) originating from body.image"
          );
        }
      }
    );
    
    await runWithContext(
      {
        ...context,
        ...{ body: { image: "http://08080404.7f000001.rbndr.us/" } },
      },
      async () => {
        const error = await t.rejects(() =>
          fetch("http://08080404.7f000001.rbndr.us/")
        );
        if (error instanceof Error) {
          t.same(
            // @ts-expect-error Type is not defined
            error.cause.message,
            "Aikido firewall has blocked a server-side request forgery: fetch(...) originating from body.image"
          );
        }
      }
    );
  
  }
);
