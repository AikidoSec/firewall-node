import * as t from "tap";
import { createTestAgent } from "../helpers/createTestAgent";
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
    const agent = createTestAgent();
    agent.start([new AwsSDKVersion3Sink()]);

    const {
      BedrockRuntimeClient,
      InvokeModelCommand,
    } = require("@aws-sdk/client-bedrock-runtime");

    const client = new BedrockRuntimeClient({
      region: process.env.AWS_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });

    const command = new InvokeModelCommand({
      modelId: "anthropic.claude-3-5-sonnet-20240620-v1:0",
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

    const response = await client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    t.same(responseBody.content[0].text.trim(), "Paris");
    t.match(agent.getAIStatistics().getStats(), [
      {
        provider: "bedrock",
        calls: 1,
        model: responseBody.model,
        tokens: {
          input: responseBody.usage.input_tokens,
          output: responseBody.usage.output_tokens,
          total:
            responseBody.usage.input_tokens + responseBody.usage.output_tokens,
        },
      },
    ]);
  }
);
