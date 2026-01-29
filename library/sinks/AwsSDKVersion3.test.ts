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

    const { BedrockRuntimeClient, InvokeModelCommand, ConverseCommand } =
      require("@aws-sdk/client-bedrock-runtime") as typeof import("@aws-sdk/client-bedrock-runtime");

    const region = process.env.AWS_REGION || "us-east-1";
    const geography = region.split("-")[0];
    const expectedModelId = `${geography}.anthropic.claude-3-5-sonnet-20240620-v1:0`;
    const modelArn = `arn:aws:bedrock:${region}::foundation-model/anthropic.claude-3-5-sonnet-20240620-v1:0`;

    // @ts-expect-error Credentials type is not working
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
        anthropic_version: "bedrock-2023-05-31",
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

    const invokeResponse = await client.send(invokeCommand);
    const responseBody = JSON.parse(
      new TextDecoder().decode(invokeResponse.body)
    );

    t.same(responseBody.content[0].text.trim(), "Paris");
    t.match(agent.getAIStatistics().getStats(), [
      {
        provider: "bedrock",
        calls: 1,
        model: expectedModelId,
        tokens: {
          input: responseBody.usage.input_tokens,
          output: responseBody.usage.output_tokens,
          total:
            responseBody.usage.input_tokens + responseBody.usage.output_tokens,
        },
      },
    ]);

    agent.getAIStatistics().reset();

    const invokeCommandArn = new InvokeModelCommand({
      modelId: modelArn,
      contentType: "application/json",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
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

    const invokeResponseArn = await client.send(invokeCommandArn);
    const responseBodyArn = JSON.parse(
      new TextDecoder().decode(invokeResponseArn.body)
    );

    t.same(responseBodyArn.content[0].text.trim(), "Paris");
    t.match(agent.getAIStatistics().getStats(), [
      {
        provider: "bedrock",
        calls: 1,
        model: responseBodyArn.model,
        tokens: {
          input: responseBodyArn.usage.input_tokens,
          output: responseBodyArn.usage.output_tokens,
          total:
            responseBodyArn.usage.input_tokens +
            responseBodyArn.usage.output_tokens,
        },
      },
    ]);

    agent.getAIStatistics().reset();

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

    const converseResponse = await client.send(converseCommand);

    t.same(
      converseResponse.output?.message?.content?.[0]?.text?.trim(),
      "Paris"
    );
    t.match(agent.getAIStatistics().getStats(), [
      {
        provider: "bedrock",
        calls: 1,
        model: expectedModelId,
        tokens: {
          input: converseResponse.usage?.inputTokens || 0,
          output: converseResponse.usage?.outputTokens || 0,
          total:
            (converseResponse.usage?.inputTokens || 0) +
            (converseResponse.usage?.outputTokens || 0),
        },
      },
    ]);

    agent.getAIStatistics().reset();

    const converseCommandArn = new ConverseCommand({
      modelId: modelArn,
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

    const converseResponseArn = await client.send(converseCommandArn);

    t.same(
      converseResponseArn.output?.message?.content?.[0]?.text?.trim(),
      "Paris"
    );
    t.same(agent.getAIStatistics().getStats().length, 0);
  }
);
