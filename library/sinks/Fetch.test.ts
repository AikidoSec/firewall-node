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

    t.same(agent.getDomains().getDomains(), []);

    await runWithContext(context, async () => {
      await fetch("http://aikido.dev");
    });

    t.same(agent.getDomains().getDomains(), ["aikido.dev"]);
    agent.getDomains().clear();

    await runWithContext(context, async () => {
      await fetch(new URL("http://aikido.dev"));
    });

    t.same(agent.getDomains().getDomains(), ["aikido.dev"]);
    agent.getDomains().clear();

    await runWithContext(context, async () => {
      await t.rejects(() => fetch(""));
    });

    t.same(agent.getDomains().getDomains(), []);
    agent.getDomains().clear();
  }
);
