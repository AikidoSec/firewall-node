import * as t from "tap";
import { Token } from "../agent/api/Token";
import { createTestAgent } from "../helpers/createTestAgent";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import { AwsSDKVersion3 as AwsSDKVersion3Sink } from "./AwsSDKVersion3";

t.test(
  "it works",
  {
    skip:
      !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY
        ? "AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY not set"
        : undefined,
  },
  async (t) => {
    const reportingAPI = new ReportingAPIForTesting();
    const agent = createTestAgent({
      api: reportingAPI,
      token: new Token("123"),
    });
    agent.start([new AwsSDKVersion3Sink()]);

    const {
      BedrockRuntimeClient,
      InvokeModelCommand,
      ConverseCommand,
    } = require("@aws-sdk/client-bedrock-runtime");

    const region = process.env.AWS_REGION || "us-east-1";
    const geography = region.split("-")[0];
    const expectedModelId = `${geography}.anthropic.claude-3-5-sonnet-20240620-v1:0`;

    const client = new BedrockRuntimeClient({
      region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });

    const invokeCommand = new InvokeModelCommand({
      modelId: expectedModelId,
      contentType: "application/json",
      body: JSON.stringify({
        // eslint-disable-next-line camelcase
        anthropic_version: "bedrock-2023-05-31",
        // eslint-disable-next-line camelcase
        max_tokens: 100,
        messages: [
          {
            role: "user",
            content:
              "What is the capital of France? Answer with just the city name, no punctuation.",
          },
        ],
      }),
    });

    await client.send(invokeCommand);

    const converseCommand = new ConverseCommand({
      modelId: expectedModelId,
      messages: [
        {
          role: "user",
          content: [
            {
              text: "What is the capital of France? Answer with just the city name, no punctuation.",
            },
          ],
        },
      ],
      inferenceConfig: {
        maxTokens: 100,
      },
    });

    await client.send(converseCommand);

    await agent.flushStats(1000);

    const events = reportingAPI.getEvents();
    const heartbeat = events.find((event) => event.type === "heartbeat");
    t.ok(heartbeat);
    t.same(heartbeat!.ai.length, 1);
    t.match(heartbeat!.ai[0], {
      model: expectedModelId,
      calls: 2,
    });
  }
);
