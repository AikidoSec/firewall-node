import * as t from "tap";
import { Agent } from "../Agent";
import { setInstance } from "../AgentSingleton";
import { APIForTesting, Token } from "../API";
import { LoggerNoop } from "../Logger";
import { runWithContext } from "../Context";
import { MongoDB } from "./MongoDB";

// TODO: Test all wrapped methods
t.test("we can highjack the MongoDB library", async (t) => {
  const agent = new Agent(
    new LoggerNoop(),
    new APIForTesting(),
    new Token("123"),
    [new MongoDB()]
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
        "Blocked NoSQL injection for MongoDB.Collection.find(...), please check body (.title)!"
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
});
