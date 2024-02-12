import * as t from "tap";
import { Agent } from "../agent/Agent";
import { setInstance } from "../agent/AgentSingleton";
import { APIForTesting, Token } from "../agent/API";
import { IDGeneratorFixed } from "../agent/IDGenerator";
import { LoggerNoop } from "../agent/Logger";
import { runWithContext } from "../agent/Context";
import { MongoDB } from "./MongoDB";

// TODO: Test all wrapped methods
t.test("we can highjack the MongoDB library", async (t) => {
  const agent = new Agent(
    true,
    new LoggerNoop(),
    new APIForTesting(),
    new Token("123"),
    [new MongoDB()],
    new IDGeneratorFixed("id"),
    false
  );
  agent.start();
  setInstance(agent);

  const { MongoClient } = require("mongodb");
  const client = new MongoClient("mongodb://root:password@127.0.0.1:27017");
  await client.connect();

  try {
    const db = client.db("test");
    const collections: { name: string }[] = await db
      .listCollections({ name: "test" })
      .toArray();
    if (collections.find((collection) => collection.name === "test")) {
      await db.dropCollection("test");
    }

    const collection = db.collection("test");
    await collection.insertOne({
      title: "Title",
    });

    t.match(
      await collection.findOne({
        title: "Title",
      }),
      { title: "Title" }
    );

    const error = await t.rejects(async () => {
      await runWithContext(
        {
          remoteAddress: "::1",
          method: "POST",
          url: "http://localhost:4000",
          query: {},
          headers: {},
          body: {
            title: {
              $ne: null,
            },
          },
          cookies: {},
        },
        () => {
          return collection.find({ title: { $ne: null } }).toArray();
        }
      );
    });
    if (error instanceof Error) {
      t.equal(
        error.message,
        "Aikido guard has blocked a NoSQL injection: MongoDB.Collection.find(...) originating from body (.title)"
      );
    }

    await runWithContext(
      {
        remoteAddress: "::1",
        method: "POST",
        url: "http://localhost:4000",
        query: {},
        headers: {},
        body: {},
        cookies: {},
      },
      () => {
        return collection.find({ title: { $ne: null } }).toArray();
      }
    );
  } catch (error) {
    t.fail(error.message);
  } finally {
    await client.close();
  }

  agent.stop();
});
