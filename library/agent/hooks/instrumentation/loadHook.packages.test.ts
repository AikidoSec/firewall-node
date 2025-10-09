import * as mod from "node:module";
import * as t from "tap";
import { createTestAgent } from "../../../helpers/createTestAgent";
import { ReportingAPIForTesting } from "../../api/ReportingAPIForTesting";
import { Token } from "../../api/Token";
import { applyHooks } from "../../applyHooks";
import { Hooks } from "../Hooks";
import { registerNodeHooks } from "./index";
import type { Event } from "../../api/Event";

// Using a separate file because we can only call registerNodeHooks once
t.test(
  "it registers all loaded packages",
  {
    skip: !("registerHooks" in mod) ? "Recent Node.js version required" : false,
  },
  async (t) => {
    const api = new ReportingAPIForTesting();
    const agent = createTestAgent({
      api: api,
      token: new Token("token"),
    });

    applyHooks(new Hooks(), true);
    registerNodeHooks();

    require("fastify");
    require("node:fs");
    require("http");
    await import("dns");
    await import("express");

    await agent.flushStats(1000);
    const events = api.getEvents();
    t.equal(events.length, 1);
    const event: Event = events[0];
    if (event.type !== "heartbeat") {
      throw new Error("Expected heartbeat");
    }
    const expectedPackages = [
      "fastify",
      "@fastify/ajv-compiler",
      "semver",
      "express",
    ];
    for (const pkg of expectedPackages) {
      t.ok(
        event.packages.find((p) => p.name === pkg),
        `Expected package ${pkg} to be in the list of loaded packages`
      );
    }
    for (const pkg of mod.builtinModules) {
      t.notOk(
        event.packages.find((p) => p.name === pkg),
        `Did not expect package ${pkg} to be in the list of loaded packages`
      );
    }
    for (const pkg of event.packages) {
      if (pkg.name.startsWith("node:")) {
        t.fail(`Did not expect package name to start with node: ${pkg.name}`);
      }
    }
  }
);
