import * as t from "tap";
import { Context, getContext } from "../agent/Context";
import { PubSub as PubSubWrapper } from "./PubSub";
import { createTestAgent } from "../helpers/createTestAgent";

t.test("it works", async () => {
  const agent = createTestAgent();
  agent.start([new PubSubWrapper()]);

  process.env.PUBSUB_EMULATOR_HOST = "127.0.0.1:8085";
  // Do not try to ping the Google Cloud Platform (GCP) metadata server
  // This causes the tap tests to not exit cleanly, if a HTTP proxy is used
  // https://github.com/googleapis/google-cloud-node-core/blob/caf493f6e55cf8a6778ddf46d8d02f2013d7a1be/packages/gcp-metadata/README.md#environment-variables
  process.env.METADATA_SERVER_DETECTION = "none";

  const projectId = "sample-project";
  const topicName = "test-topic";
  const subscriptionName = "test-subscription";

  const { PubSub } =
    require("@google-cloud/pubsub") as typeof import("@google-cloud/pubsub");

  const pubsub = new PubSub({
    projectId: projectId,
    emulatorMode: true,
  });

  const [topic] = await pubsub.topic(topicName).get({ autoCreate: true });

  const [subscription] = await topic
    .subscription(subscriptionName)
    .get({ autoCreate: true });

  let lastContextInMessageHandler: Context | undefined;

  subscription.on("message", (message) => {
    lastContextInMessageHandler = getContext();
  });

  await topic.publishMessage({
    data: Buffer.from(JSON.stringify({ key: "value", arr: [1, 2] })),
  });

  await new Promise((resolve) => setTimeout(resolve, 1000));

  t.match(lastContextInMessageHandler, {
    headers: {},
    cookies: {},
    query: {},
    routeParams: {},
    source: "pubsub",
    body: {
      key: "value",
      arr: [1, 2],
    },
  });

  await subscription.close();
  await pubsub.close();
});
