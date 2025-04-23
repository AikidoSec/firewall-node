import * as t from "tap";
import { startTestAgent } from "../helpers/startTestAgent";
import { AiSDK } from "./AiSDK";
import { getContext, runWithContext, type Context } from "../agent/Context";

t.test("It works with agentic", async (t) => {
  startTestAgent({
    wrappers: [new AiSDK()],
    rewrite: {},
  });

  const getTestContext = (message: string): Context => {
    return {
      remoteAddress: "::1",
      method: "POST",
      url: "http://localhost:4000",
      query: {
        message,
      },
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
  const { generateText, tool } = require("ai") as typeof import("ai");
  const { z } = require("zod") as typeof import("zod");

  const callWithPrompt = async (prompt: string) => {
    return await generateText({
      model: google("models/gemini-2.0-flash"),
      tools: {
        weather: tool({
          description: "Get the weather in a location",
          parameters: z.object({
            location: z
              .string()
              .describe("The location to get the weather for"),
          }),
          execute: async ({ location }) => {
            const temperature = location === "Norway" ? 5 : 24;
            return {
              temperature,
              context: getContext(),
            };
          },
        }),
      },
      prompt: prompt,
    });
  };

  await runWithContext(
    getTestContext("What is the weather in San Francisco?"),
    async () => {
      const result = await callWithPrompt(
        "What is the weather in San Francisco?"
      );

      t.same(result.toolResults.length, 1);
      t.same(result.toolResults[0].toolName, "weather");
      t.same(result.toolResults[0].result.temperature, 24);
      t.match(result.toolResults[0].result.context, {
        remoteAddress: "::1",
        method: "POST",
        url: "http://localhost:4000",
        query: {
          message: "What is the weather in San Francisco?",
        },
        body: undefined,
        headers: {},
        cookies: {},
        routeParams: {},
        source: "express",
        route: "/posts/:id",
        aiToolParams: [
          {
            location: "San Francisco",
          },
        ],
      });
    }
  );
});
