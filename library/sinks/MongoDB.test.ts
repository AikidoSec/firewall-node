import * as t from "tap";
import { Agent } from "../agent/Agent";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import { ConfigAPIForTesting } from "../agent/config-api/ConfigAPIForTesting";
import { Context, runWithContext } from "../agent/Context";
import { LoggerNoop } from "../agent/logger/LoggerNoop";
import { MongoDB } from "./MongoDB";

const unsafeContext: Context = {
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
  routeParams: {},
  source: "express",
  route: "/posts/:id",
};

const safeContext: Context = {
  remoteAddress: "::1",
  method: "POST",
  url: "http://localhost:4000",
  query: {},
  headers: {},
  body: {},
  cookies: {},
  routeParams: {},
  source: "express",
  route: "/posts/:id",
};

t.test("it inspects method calls and blocks if needed", async (t) => {
  const agent = new Agent(
    true,
    new LoggerNoop(),
    new ReportingAPIForTesting(),
    undefined,
    "lambda"
  );
  agent.start([new MongoDB()]);

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

    // Bulk write without context
    await collection.bulkWrite([
      {
        updateMany: {
          filter: { someField: "value" },
          update: { $set: { someField: "New Title" } },
        },
      },
    ]);

    const bulkError = await t.rejects(async () => {
      await runWithContext(unsafeContext, () => {
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
      t.same(
        bulkError.message,
        "Aikido runtime has blocked a NoSQL injection: MongoDB.Collection.bulkWrite(...) originating from body.myTitle"
      );
    }

    const error = await t.rejects(async () => {
      await runWithContext(unsafeContext, () => {
        return collection.find({ title: { $ne: null } }).toArray();
      });
    });

    if (error instanceof Error) {
      t.same(
        error.message,
        "Aikido runtime has blocked a NoSQL injection: MongoDB.Collection.find(...) originating from body.myTitle"
      );
    }

    // Test if it checks arguments
    await runWithContext(safeContext, async () => {
      await t.rejects(async () => collection.bulkWrite());
      await t.rejects(async () => collection.bulkWrite(1));
      await t.rejects(async () => collection.bulkWrite([1]));
      await t.rejects(async () => collection.bulkWrite([]));
      await t.rejects(async () => collection.bulkWrite([{}]));
      await t.rejects(async () =>
        collection.bulkWrite([
          {
            updateOne: {
              // Structure similar to what MongoDB expects, but without 'filter'
              update: { $set: { a: 1 } },
            },
          },
        ])
      );
      await t.rejects(() => collection.updateOne());
      await t.rejects(() => collection.updateOne(1));
    });

    await runWithContext(
      {
        remoteAddress: "::1",
        method: "POST",
        url: "http://localhost:4000",
        query: {},
        headers: {},
        body: {},
        cookies: {},
        source: "express",
      },
      () => {
        return collection.find({ title: { $ne: null } }).toArray();
      }
    );
  } catch (error: any) {
    t.fail(error.message);
  } finally {
    await client.close();
  }
});
