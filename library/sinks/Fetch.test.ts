import * as t from "tap";
import { Agent } from "../agent/Agent";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import { ConfigAPIForTesting } from "../agent/config-api/ConfigAPIForTesting";
import { Token } from "../agent/api/Token";
import { LoggerNoop } from "../agent/logger/LoggerNoop";
import { Fetch } from "./Fetch";

t.test(
  "it works",
  { skip: !global.fetch ? "fetch is not available" : false },
  async (t) => {
    const agent = new Agent(
      true,
      new LoggerNoop(),
      new ReportingAPIForTesting(),
      new Token("123"),
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
  }
);
