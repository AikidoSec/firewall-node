import * as t from "tap";
import { startTestAgent } from "../helpers/startTestAgent";
import { AiSDK } from "./AiSDK";
import { runWithContext, type Context } from "../agent/Context";
import { getMajorNodeVersion } from "../helpers/getNodeVersion";
import { getInstance } from "../agent/AgentSingleton";
import { setTimeout } from "timers/promises";
import { isEsmUnitTest } from "../helpers/isEsmUnitTest";

export function createAiSdkTests(
  pkgName: string,
  googlePkgName: string,
  zodPkgName: string
) {
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
        rewrite: {
          ai: pkgName,
        },
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

      const { google } = require(
        googlePkgName
      ) as typeof import("@ai-sdk/google-v3");
      const { generateText, generateObject, streamText, streamObject } =
        require(pkgName) as typeof import("ai-v6");

      const { z } = require(zodPkgName) as typeof import("zod/v4");

      await runWithContext(getTestContext(), async () => {
        const agent = getInstance();
        if (!agent) {
          throw new Error("Agent instance not found");
        }

        await generateText({
          model: google("models/gemini-2.5-flash-lite"),
          prompt: "What is Zen by Aikido Security? Return one sentence.",
        });

        t.match(agent.getAIStatistics().getStats(), [
          {
            provider: "gemini",
            model: "gemini-2.5-flash-lite",
            calls: 1,
          },
        ]);

        t.ok(
          agent.getAIStatistics().getStats()[0].tokens.input > 0,
          "Input tokens should be greater than 0"
        );

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

        const resultObj = await generateObject({
          model: google("models/gemini-2.5-flash-lite"),
          prompt: "Return numbers one to five",
          output: "array",
          schema: z.array(z.number()),
        });
        t.ok(resultObj.object);

        t.match(agent.getAIStatistics().getStats(), [
          {
            provider: "gemini",
            model: "gemini-2.5-flash-lite",
            calls: 2,
          },
        ]);

        await setTimeout(400);

        const stream = streamText({
          model: google("models/gemini-2.5-flash"),
          prompt: "What is Zen by Aikido Security? Return one sentence.",
        });

        let streamedText = "";
        for await (const chunk of stream.textStream) {
          streamedText += chunk;
        }

        t.ok(streamedText.length > 0, "Streamed text should not be empty");

        t.match(agent.getAIStatistics().getStats(), [
          {
            provider: "gemini",
            model: "gemini-2.5-flash-lite",
            calls: 2,
          },
          {
            provider: "gemini",
            model: "gemini-2.5-flash",
            calls: 1,
          },
        ]);

        t.ok(
          agent.getAIStatistics().getStats()[1].tokens.input > 0,
          "Input tokens should be greater than 0"
        );

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

        await setTimeout(400);

        const objectStream = streamObject({
          model: google("models/gemini-2.5-flash"),
          prompt: "Return numbers one to five",
          output: "array",
          schema: z.array(z.number()),
        });

        const streamedObject = [];
        for await (const chunk of objectStream.elementStream) {
          streamedObject.push(chunk);
        }

        t.ok(resultObj.object);

        t.match(agent.getAIStatistics().getStats(), [
          {
            provider: "gemini",
            model: "gemini-2.5-flash-lite",
            calls: 2,
          },
          {
            provider: "gemini",
            model: "gemini-2.5-flash",
            calls: 2,
          },
        ]);

        if (pkgName === "ai-v6" && isEsmUnitTest()) {
          agent.getAIStatistics().reset();

          // The ToolLoopAgent is currently only protected in ESM applications
          // As for CJS we only modify the exported generate functions
          // and internally the ToolLoopAgent uses the unwrapped generate function directly
          const { ToolLoopAgent } = require(pkgName) as typeof import("ai-v6");
          const agentInstance = new ToolLoopAgent({
            model: google("models/gemini-2.5-flash-lite"),
            tools: {},
          });

          const result = await agentInstance.generate({
            prompt: "What is Zen by Aikido Security? Return one sentence.",
          });

          t.ok(result.text.length > 0, "Agent result text should not be empty");

          t.match(agent.getAIStatistics().getStats(), [
            {
              provider: "gemini",
              model: "gemini-2.5-flash-lite",
              calls: 1,
            },
          ]);
        }
      });
    }
  );
}
