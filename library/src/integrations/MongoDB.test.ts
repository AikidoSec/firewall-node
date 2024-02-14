import * as t from "tap";
import { Agent } from "../agent/Agent";
import { setInstance } from "../agent/AgentSingleton";
import { APIForTesting, Token } from "../agent/API";
import { IDGeneratorFixed } from "../agent/IDGenerator";
import { LoggerNoop } from "../agent/Logger";
import { Context, runWithContext } from "../agent/Context";
import { MongoDB } from "./MongoDB";

const context: Context = {
  remoteAddress: "::1",
  method: "POST",
  url: "http://localhost:4000",
  query: {},
  headers: {},
  body: {
    myTitle: {
      $ne: null,
    },
  },
  cookies: {},
};

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

    t.same(await collection.count({ title: "Title" }), 0);

    await collection.insertOne({
      title: "Title",
    });

    t.same(await collection.count({ title: "Title" }), 1);

    t.match(
      await collection.findOne({
        title: "Title",
      }),
      { title: "Title" }
    );

    await collection.updateOne(
      { title: "Title" },
      { $set: { title: "New Title" } }
    );

    await collection.updateMany(
      { title: "New Title" },
      { $set: { title: "Another Title" } }
    );

    await collection.replaceOne(
      { title: "Another Title" },
      { title: "Yet Another Title" }
    );

    t.same(await collection.count({ title: "Yet Another Title" }), 1);

    await collection.deleteOne({ title: "Yet Another Title" });

    t.same(await collection.count({ title: "Yet Another Title" }), 0);
    // @ts-expect-error Private property
    t.same(agent.stats, {
      mongodb: {
        blocked: 0,
        total: 10,
        allowed: 10,
        withoutContext: 10,
      },
    });

    const bulkError = await t.rejects(async () => {
      await runWithContext(context, () => {
        return collection.bulkWrite([
          {
            updateMany: {
              filter: { title: { $ne: null } },
              update: { $set: { title: "New Title" } },
            },
          },
        ]);
      });
    });

    if (bulkError instanceof Error) {
      t.equal(
        bulkError.message,
        "Aikido guard has blocked a NoSQL injection: MongoDB.Collection.bulkWrite(...) originating from body (.myTitle)"
      );
    }

    const error = await t.rejects(async () => {
      await runWithContext(context, () => {
        return collection.find({ title: { $ne: null } }).toArray();
      });
    });

    if (error instanceof Error) {
      t.equal(
        error.message,
        "Aikido guard has blocked a NoSQL injection: MongoDB.Collection.find(...) originating from body (.myTitle)"
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
