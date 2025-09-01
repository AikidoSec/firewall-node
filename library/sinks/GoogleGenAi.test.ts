import * as t from "tap";
import { startTestAgent } from "../helpers/startTestAgent";
import { GoogleGenAi as GoogleGenAiWrapper } from "./GoogleGenAi";
import { runWithContext, type Context } from "../agent/Context";
import { getMajorNodeVersion } from "../helpers/getNodeVersion";
import { getInstance } from "../agent/AgentSingleton";
import { setTimeout } from "timers/promises";

t.test(
  "it works",
  {
    skip:
      !process.env.GOOGLE_GENERATIVE_AI_API_KEY || getMajorNodeVersion() < 22
        ? "Google API key not set or Node version < 22"
        : undefined,
  },
  async (t) => {
    startTestAgent({
      wrappers: [new GoogleGenAiWrapper()],
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

    const { GoogleGenAI } =
      require("@google/genai") as typeof import("@google/genai");

    const ai = new GoogleGenAI({
      apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    });
    await runWithContext(getTestContext(), async () => {
      const agent = getInstance();
      if (!agent) {
        throw new Error("Agent instance not found");
      }

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-lite",
        contents: `What is the third largest city in Belgium? Only reply with the name.`,
      });

      t.same(response.text, "Ghent");

      t.match(agent.getAIStatistics().getStats(), [
        {
          provider: "google",
          model: "gemini-2.5-flash-lite",
          calls: 1,
          tokens: {
            input: 16,
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

      await setTimeout(400);

      const chat = ai.chats.create({
        model: "gemini-2.5-flash",
        config: {
          maxOutputTokens: 10,
        },
      });

      await chat.sendMessage({
        message: "What is the capital of France?",
      });

      t.match(agent.getAIStatistics().getStats(), [
        {
          provider: "google",
          model: "gemini-2.5-flash-lite",
          calls: 1,
          tokens: {
            input: 16,
          },
        },
        {
          provider: "google",
          model: "gemini-2.5-flash",
          calls: 1,
          tokens: {
            input: 8,
          },
        },
      ]);

      t.ok(
        agent.getAIStatistics().getStats()[1].tokens.output > 0,
        "Output tokens should be greater than 0"
      );
      t.equal(
        agent.getAIStatistics().getStats()[1].tokens.total,
        agent.getAIStatistics().getStats()[1].tokens.input +
          agent.getAIStatistics().getStats()[1].tokens.output,
        "Total tokens should match input + output"
      );
    });
  }
);
