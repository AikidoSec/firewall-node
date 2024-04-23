import * as t from "tap";
import { fetch, request } from "undici";
import { Agent } from "../agent/Agent";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import { Token } from "../agent/api/Token";
import { LoggerNoop } from "../agent/logger/LoggerNoop";
import { Undici } from "./Undici";

t.test(
  "it works",
  {
    skip: process.version.startsWith("v16")
      ? "ReadableStream is not available"
      : false,
  },
  async () => {
    const agent = new Agent(
      true,
      new LoggerNoop(),
      new ReportingAPIForTesting(),
      new Token("123"),
      undefined
    );

    agent.start([new Undici()]);

    const { request, fetch } = require("undici");

    await request("https://aikido.dev");
    t.same(agent.getHostnames().asArray(), [
      { hostname: "aikido.dev", port: 443 },
    ]);
    agent.getHostnames().clear();

    await fetch("https://aikido.dev");
    t.same(agent.getHostnames().asArray(), [
      { hostname: "aikido.dev", port: 443 },
    ]);
    agent.getHostnames().clear();

    await request({ protocol: "https:", hostname: "aikido.dev", port: 443 });
    t.same(agent.getHostnames().asArray(), [
      { hostname: "aikido.dev", port: 443 },
    ]);
    agent.getHostnames().clear();

    await request({ protocol: "https:", hostname: "aikido.dev", port: "443" });
    t.same(agent.getHostnames().asArray(), [
      { hostname: "aikido.dev", port: "443" },
    ]);
    agent.getHostnames().clear();

    await request({
      protocol: "https:",
      hostname: "aikido.dev",
      port: undefined,
    });
    t.same(agent.getHostnames().asArray(), [
      { hostname: "aikido.dev", port: 443 },
    ]);
    agent.getHostnames().clear();

    await request({
      protocol: "http:",
      hostname: "aikido.dev",
      port: undefined,
    });
    t.same(agent.getHostnames().asArray(), [
      { hostname: "aikido.dev", port: 80 },
    ]);
    agent.getHostnames().clear();

    await request({
      protocol: "https:",
      hostname: "aikido.dev",
      port: "443",
    });
    t.same(agent.getHostnames().asArray(), [
      { hostname: "aikido.dev", port: "443" },
    ]);
    agent.getHostnames().clear();

    await request(new URL("https://aikido.dev"));
    t.same(agent.getHostnames().asArray(), [
      { hostname: "aikido.dev", port: 443 },
    ]);
    agent.getHostnames().clear();

    await t.rejects(() => request("invalid url"));
    await t.rejects(() => request({ hostname: "" }));
  }
);
