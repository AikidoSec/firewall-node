import * as t from "tap";
import { Context, runWithContext } from "../agent/Context";
import { createTestAgent } from "../helpers/createTestAgent";
import { isEsmUnitTest } from "../helpers/isEsmUnitTest";
import { resolve } from "path";
import { Path } from "./Path";

t.test(
  "node internals building stack traces do not trigger path.resolve attacks",
  // ESM frames are file:// URLs, so Node does not call path.resolve for them
  { skip: isEsmUnitTest() ? "requires CommonJS" : false },
  async (t) => {
    const agent = createTestAgent({ block: false });
    const detectedAttacks: { operation: string; stack: string }[] = [];
    const original = agent.onDetectedAttack.bind(agent);
    agent.onDetectedAttack = (attack) => {
      detectedAttacks.push({
        operation: attack.operation,
        stack: attack.stack,
      });
      return original(attack);
    };
    agent.start([new Path()]);

    require("path");

    const context: Context = {
      remoteAddress: "::1",
      method: "GET",
      url: "http://localhost:4000/files",
      query: {},
      headers: {},
      body: { name: __filename },
      cookies: {},
      routeParams: {},
      source: "express",
      route: "/files",
    };

    process.setSourceMapsEnabled(true);
    try {
      runWithContext(context, () => {
        void new Error().stack;
      });

      t.same(detectedAttacks, [], "No attack reported for Node internals");

      runWithContext(context, () => {
        try {
          resolve(__filename);
        } catch {
          // Ignore
        }
      });
    } finally {
      process.setSourceMapsEnabled(false);
    }

    t.same(detectedAttacks.length, 1);
    t.same(detectedAttacks[0]?.operation, "path.resolve");
    t.same(detectedAttacks[0]?.stack.includes("source_map"), false);
  }
);
