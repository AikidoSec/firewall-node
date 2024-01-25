import * as t from "tap";
import { Aikido } from "../Aikido";
import { APIForTesting } from "../API";
import { LoggerNoop } from "../Logger";
import { runWithContext } from "../RequestContext";
import { MongoDB } from "./MongoDB";

// TODO: Test all wrapped methods
t.test("we can highjack the MongoDB library", async () => {
  new MongoDB().setup();

  const { MongoClient } = require("mongodb");
  const client = new MongoClient("mongodb://root:password@127.0.0.1:27017");
  await client.connect();

  try {
    const db = client.db("test");
    const collections = await db.listCollections({ name: "test" }).toArray();
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

    await t.rejects(async () => {
      await runWithContext(
        {
          aikido: new Aikido(new LoggerNoop(), new APIForTesting(), undefined),
          request: {
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
          },
        },
        () => {
          return collection.find({ title: { $ne: null } }).toArray();
        }
      );
    });

    await runWithContext(
      {
        aikido: new Aikido(new LoggerNoop(), new APIForTesting(), undefined),
        request: {
          remoteAddress: "::1",
          method: "POST",
          url: "http://localhost:4000",
          query: {},
          headers: {},
          body: {},
        },
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
