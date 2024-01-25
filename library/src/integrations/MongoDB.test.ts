import * as t from "tap";
import { Aikido } from "../Aikido";
import { APIForTesting } from "../API";
import { LoggerNoop } from "../Logger";
import { runWithContext } from "../RequestContext";
import { MongoDB } from "./MongoDB";

t.test("we can highjack the MongoDB library", async () => {
  new MongoDB().setup();

  const { MongoClient } = require("mongodb");
  const client = new MongoClient("mongodb://root:password@127.0.0.1:27017");
  await client.connect();

  const collection = client.db("test").collection("tests");
  await collection.drop();

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

  await client.close();
});
