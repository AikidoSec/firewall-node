const { preventPrototypePollution, protect } = require("@aikidosec/runtime");

protect({ debug: true });

const { PubSub } = require("@google-cloud/pubsub");
const { MongoClient } = require("mongodb");
const { Users, User } = require("./users");

preventPrototypePollution();

async function receiveMessage(client, body) {
  const users = new Users(client);
  const user = await users.findBy("hans@aikido.dev", "password");

  if (!user) {
    // Ensure a user exists for testing
    await users.persist(new User("hans@aikido.dev", "password"));
  }

  if (!body.username || !body.password) {
    return;
  }

  // This is just for demo purposes, normally you'd use bcrypt or something
  // This is a vulnerability, which can be abused for demo purposes
  // If password is { $gt: "" } then it will match any password
  const actualUser = await users.findBy(body.username, body.password);

  if (!actualUser) {
    return;
  }

  console.log("User authenticated:", body.username);
}

async function main() {
  const client = new MongoClient("mongodb://root:password@127.0.0.1:27017");
  await client.connect();

  const pubSub = new PubSub({ projectId: "journy-io" });
  const topic = await pubSub.topic("my-topic");
  const subscription = await topic.subscription("my-sub");

  subscription.on("message", async (message) => {
    const body = JSON.parse(message.data.toString());
    console.log("Received message:", body);
    await receiveMessage(client, body);
    message.ack();
  });

  subscription.on("error", (error) => {
    console.error("Received error:", error);
    process.exit(1);
  });
}

main();
