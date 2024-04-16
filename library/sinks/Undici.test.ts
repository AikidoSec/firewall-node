import * as t from "tap";
import { Agent } from "../agent/Agent";
import { APIForTesting } from "../agent/api/APIForTesting";
import { Token } from "../agent/api/Token";
import { Context, runWithContext } from "../agent/Context";
import { LoggerNoop } from "../agent/logger/LoggerNoop";
import { Undici } from "./Undici";

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
  source: "express",
};

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
      new APIForTesting(),
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
      { hostname: "aikido.dev", port: undefined },
    ]);
    agent.getHostnames().clear();

    await request(new URL("https://aikido.dev"));
    t.same(agent.getHostnames().asArray(), [
      { hostname: "aikido.dev", port: 443 },
    ]);
    agent.getHostnames().clear();

    await t.rejects(() => request("invalid url"));
    await t.rejects(() => request({ hostname: "" }));

    await runWithContext(context, async () => {
      await request("https://google.com");
      const error = await t.rejects(() =>
        request("http://localhost:4000/api/internal")
      );
      if (error instanceof Error) {
        t.same(
          error.message,
          "Aikido runtime has blocked a Server-side request forgery: undici.request(...) originating from body.image"
        );
      }
      const error2 = await t.rejects(() =>
        request(new URL("http://localhost:4000/api/internal"))
      );
      if (error2 instanceof Error) {
        t.same(
          error2.message,
          "Aikido runtime has blocked a Server-side request forgery: undici.request(...) originating from body.image"
        );
      }
      const error3 = await t.rejects(() =>
        request({
          protocol: "http:",
          hostname: "localhost",
          port: 4000,
          path: "/api/internal",
        })
      );
      if (error3 instanceof Error) {
        t.same(
          error3.message,
          "Aikido runtime has blocked a Server-side request forgery: undici.request(...) originating from body.image"
        );
      }
    });
  }
);