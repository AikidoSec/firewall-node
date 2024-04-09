import * as t from "tap";
import { Agent } from "../agent/Agent";
import { APIForTesting } from "../agent/api/APIForTesting";
import { Token } from "../agent/api/Token";
import { Context, runWithContext } from "../agent/Context";
import { LoggerNoop } from "../agent/logger/LoggerNoop";
import { Fetch } from "./Fetch";

const context: Context = {
  remoteAddress: "::1",
  method: "POST",
  url: "http://localhost:4000",
  query: {},
  headers: {},
  body: {},
  cookies: {},
  source: "express",
};

t.test(
  "it works",
  { skip: !global.fetch ? "fetch is not available" : false },
  async (t) => {
    const agent = new Agent(
      true,
      new LoggerNoop(),
      new APIForTesting(),
      new Token("123"),
      undefined
    );
    agent.start([new Fetch()]);

    t.same(agent.getHostnames().asArray(), []);

    await runWithContext(context, async () => {
      await fetch("http://aikido.dev");
    });

    t.same(agent.getHostnames().asArray(), [
      { hostname: "aikido.dev", port: 80 },
    ]);
    agent.getHostnames().clear();

    await runWithContext(context, async () => {
      await fetch(new URL("https://aikido.dev"));
    });

    t.same(agent.getHostnames().asArray(), [
      { hostname: "aikido.dev", port: 443 },
    ]);
    agent.getHostnames().clear();

    await runWithContext(context, async () => {
      await t.rejects(() => fetch(""));
    });

    t.same(agent.getHostnames().asArray(), []);
    agent.getHostnames().clear();
  }
);
