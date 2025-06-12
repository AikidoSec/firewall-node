import * as t from "tap";
import { startTestAgent } from "../helpers/startTestAgent";
import { AiSDK } from "./AiSDK";
import { runWithContext, type Context } from "../agent/Context";
import { getMajorNodeVersion } from "../helpers/getNodeVersion";
import { getInstance } from "../agent/AgentSingleton";
import { z } from "zod";

t.test(
  "It works",
  {
    skip:
      !process.env.GOOGLE_GENERATIVE_AI_API_KEY || getMajorNodeVersion() < 22
        ? "Google API key not set or Node version < 22"
        : undefined,
  },
  async (t) => {
    startTestAgent({
      wrappers: [new AiSDK()],
      rewrite: {},
    });

    const getTestContext = (): Context => {
      return {
        remoteAddress: "::1",
        method: "POST",
        url: "http://localhost:4000",
        query: {},
        body: undefined,
        headers: {},
        cookies: {},
        routeParams: {},
        source: "express",
        route: "/posts/:id",
      };
    };

    const { google } =
      require("@ai-sdk/google") as typeof import("@ai-sdk/google");
    const { generateText, generateObject } =
      require("ai") as typeof import("ai");

    await runWithContext(getTestContext(), async () => {
      await generateText({
        model: google("models/gemini-2.0-flash-lite"),
        prompt: "What is Zen by Aikido Security? Return one sentence.",
      });

      const agent = getInstance();
      if (!agent) {
        throw new Error("Agent instance not found");
      }

      t.match(agent.getAIStatistics().getStats(), [
        {
          provider: "gemini",
          model: "gemini-2.0-flash-lite",
          calls: 1,
          tokens: {
            input: 12,
          },
        },
      ]);

      t.ok(
        agent.getAIStatistics().getStats()[0].tokens.output > 0,
        "Output tokens should be greater than 0"
      );
      t.equal(
        agent.getAIStatistics().getStats()[0].tokens.total,
        agent.getAIStatistics().getStats()[0].tokens.input +
          agent.getAIStatistics().getStats()[0].tokens.output,
        "Total tokens should match input + output"
      );

      const resultObj = await generateObject({
        model: google("models/gemini-2.0-flash-lite"),
        prompt: "Return numbers one to five",
        output: "array",
        schema: z.array(z.number()),
      });
      t.same(resultObj.object, [[1], [2], [3], [4], [5]]);

      t.match(agent.getAIStatistics().getStats(), [
        {
          provider: "gemini",
          model: "gemini-2.0-flash-lite",
          calls: 2,
          tokens: {
            input: 23,
          },
        },
      ]);
    });
  }
);
