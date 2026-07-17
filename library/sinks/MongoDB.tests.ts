import t from "tap";
import { Context, runWithContext } from "../agent/Context";
import { startTestAgent } from "../helpers/startTestAgent";
import { MongoDB } from "./MongoDB";

export function createMongoDBTests(
  mongoPkgName: string,
  collectionName: string
) {
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
    startTestAgent({
      serverless: "lambda",
      wrappers: [new MongoDB()],
      rewrite: {
        mongodb: mongoPkgName,
      },
    });

    const { MongoClient } = require(
      mongoPkgName
    ) as typeof import("mongodb-v6");
    const client = new MongoClient("mongodb://root:password@127.0.0.1:27017");
    await client.connect();

    try {
      const db = client.db(collectionName);
      const collections: { name: string }[] = await db
        .listCollections({ name: collectionName })
        .toArray();
      if (
        collections.find((collection) => collection.name === collectionName)
      ) {
        await db.dropCollection(collectionName);
      }

      const collection = db.collection(collectionName);

      t.same(await collection.count({ title: "Title" }), 0);

      await collection.insertOne({
        title: "Title",
      });

      t.same(await collection.count({ title: "Title" }), 1);

      const cursor = collection.aggregate([
        {
          $group: {
            _id: "$title",
            count: { $sum: 1 },
          },
        },
      ]);

      t.same(await cursor.toArray(), [{ _id: "Title", count: 1 }]);

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

      t.same(await collection.distinct("title", { title: { $ne: null } }), [
        "Yet Another Title",
      ]);
      t.same(await collection.distinct("title"), ["Yet Another Title"]);

      // With context
      await runWithContext(safeContext, async () => {
        t.same(await collection.distinct("title", { title: { $ne: null } }), [
          "Yet Another Title",
        ]);
      });

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
          "Zen has blocked a NoSQL injection: MongoDB.Collection.bulkWrite(...) originating from body.myTitle"
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
          "Zen has blocked a NoSQL injection: MongoDB.Collection.find(...) originating from body.myTitle"
        );
      }

      const aggregateError = await t.rejects(async () => {
        await runWithContext(
          {
            ...unsafeContext,
            body: [
              {
                $group: {
                  _id: "$title",
                  count: { $sum: 1 },
                },
              },
            ],
          },
          () => {
            return collection
              .aggregate([
                {
                  $group: {
                    _id: "$title",
                    count: { $sum: 1 },
                  },
                },
              ])
              .toArray();
          }
        );
      });

      if (aggregateError instanceof Error) {
        t.same(
          aggregateError.message,
          "Zen has blocked a NoSQL injection: MongoDB.Collection.aggregate(...) originating from body.[0]"
        );
      }

      const distinctError = await t.rejects(async () => {
        await runWithContext(unsafeContext, () => {
          return collection.distinct("title", { title: { $ne: null } });
        });
      });
      t.ok(distinctError instanceof Error);
      if (distinctError instanceof Error) {
        t.same(
          distinctError.message,
          "Zen has blocked a NoSQL injection: MongoDB.Collection.distinct(...) originating from body.myTitle"
        );
      }

      const updateOneError = await t.rejects(async () => {
        await runWithContext(unsafeContext, () => {
          return collection.updateOne(
            { title: "Yet Another Title" },
            { $set: { title: { $ne: null } } }
          );
        });
      });
      if (updateOneError instanceof Error) {
        t.same(
          updateOneError.message,
          "Zen has blocked a NoSQL injection: MongoDB.Collection.updateOne(...) originating from body.myTitle"
        );
      }

      const updateOnePipelineError = await t.rejects(async () => {
        await runWithContext(unsafeContext, () => {
          return collection.updateOne({ title: "Yet Another Title" }, [
            { $set: { title: { $ne: null } } },
          ]);
        });
      });
      if (updateOnePipelineError instanceof Error) {
        t.same(
          updateOnePipelineError.message,
          "Zen has blocked a NoSQL injection: MongoDB.Collection.updateOne(...) originating from body.myTitle"
        );
      }

      const updateManyError = await t.rejects(async () => {
        await runWithContext(unsafeContext, () => {
          return collection.updateMany({}, { $set: { title: { $ne: null } } });
        });
      });
      if (updateManyError instanceof Error) {
        t.same(
          updateManyError.message,
          "Zen has blocked a NoSQL injection: MongoDB.Collection.updateMany(...) originating from body.myTitle"
        );
      }

      const replaceOneError = await t.rejects(async () => {
        await runWithContext(unsafeContext, () => {
          return collection.replaceOne(
            { title: "Yet Another Title" },
            { title: { $ne: null } }
          );
        });
      });
      if (replaceOneError instanceof Error) {
        t.same(
          replaceOneError.message,
          "Zen has blocked a NoSQL injection: MongoDB.Collection.replaceOne(...) originating from body.myTitle"
        );
      }

      const findOneAndUpdateError = await t.rejects(async () => {
        await runWithContext(unsafeContext, () => {
          return collection.findOneAndUpdate(
            { title: "Yet Another Title" },
            { $set: { title: { $ne: null } } }
          );
        });
      });
      if (findOneAndUpdateError instanceof Error) {
        t.same(
          findOneAndUpdateError.message,
          "Zen has blocked a NoSQL injection: MongoDB.Collection.findOneAndUpdate(...) originating from body.myTitle"
        );
      }

      const findOneAndReplaceError = await t.rejects(async () => {
        await runWithContext(unsafeContext, () => {
          return collection.findOneAndReplace(
            { title: "Yet Another Title" },
            { title: { $ne: null } }
          );
        });
      });
      if (findOneAndReplaceError instanceof Error) {
        t.same(
          findOneAndReplaceError.message,
          "Zen has blocked a NoSQL injection: MongoDB.Collection.findOneAndReplace(...) originating from body.myTitle"
        );
      }

      const bulkUpdateError = await t.rejects(async () => {
        await runWithContext(unsafeContext, () => {
          return collection.bulkWrite([
            {
              updateOne: {
                filter: { title: "Yet Another Title" },
                update: { $set: { title: { $ne: null } } },
              },
            },
          ]);
        });
      });
      if (bulkUpdateError instanceof Error) {
        t.same(
          bulkUpdateError.message,
          "Zen has blocked a NoSQL injection: MongoDB.Collection.bulkWrite(...) originating from body.myTitle"
        );
      }

      const bulkReplaceError = await t.rejects(async () => {
        await runWithContext(unsafeContext, () => {
          return collection.bulkWrite([
            {
              replaceOne: {
                filter: { title: "Yet Another Title" },
                replacement: { title: { $ne: null } },
              },
            },
          ]);
        });
      });
      if (bulkReplaceError instanceof Error) {
        t.same(
          bulkReplaceError.message,
          "Zen has blocked a NoSQL injection: MongoDB.Collection.bulkWrite(...) originating from body.myTitle"
        );
      }

      await runWithContext(safeContext, async () => {
        // @ts-expect-error Test if it checks arguments
        await t.rejects(async () => collection.bulkWrite());
        // @ts-expect-error Test if it checks arguments
        await t.rejects(async () => collection.bulkWrite(1));
        // @ts-expect-error Test if it checks arguments
        await t.rejects(async () => collection.bulkWrite([1]));
        await t.rejects(async () => collection.bulkWrite([]));
        // @ts-expect-error Test if it checks arguments
        await t.rejects(async () => collection.bulkWrite([{}]));
        await t.rejects(async () =>
          collection.bulkWrite([
            {
              // @ts-expect-error Structure similar to what MongoDB expects, but without 'filter'
              updateOne: {
                update: { $set: { a: 1 } },
              },
            },
          ])
        );
        // @ts-expect-error Test if it checks arguments
        await t.rejects(() => collection.updateOne());
        // @ts-expect-error Test if it checks arguments
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
          route: "/posts/:id",
          routeParams: {},
        },
        () => {
          return collection.find({ title: { $ne: null } }).toArray();
        }
      );

      const constructorError = await t.rejects(async () => {
        await runWithContext(
          {
            ...unsafeContext,
            body: {
              name: {
                $ne: null,
                constructor: "bypass",
              },
            },
          },
          () => {
            return collection.find({ title: { $ne: null } }).toArray();
          }
        );
      });
      t.ok(constructorError instanceof Error);
      if (constructorError instanceof Error) {
        t.same(
          constructorError.message,
          "Zen has blocked a NoSQL injection: MongoDB.Collection.find(...) originating from body.name"
        );
      }

      await runWithContext(safeContext, async () => {
        const bulk = collection.initializeOrderedBulkOp();
        bulk
          .find({ title: "Yet Another Title" })
          .update({ $set: { title: "Bulk Title" } });
        await bulk.execute();
      });

      const orderedBulkFindError = await t.rejects(async () => {
        await runWithContext(unsafeContext, async () => {
          const bulk = collection.initializeOrderedBulkOp();
          bulk
            .find({ title: { $ne: null } })
            .update({ $set: { title: "Injected" } });
          await bulk.execute();
        });
      });
      t.ok(orderedBulkFindError instanceof Error);
      if (orderedBulkFindError instanceof Error) {
        t.same(
          orderedBulkFindError.message,
          "Zen has blocked a NoSQL injection: MongoDB.Collection.find(...) originating from body.myTitle"
        );
      }

      await runWithContext(safeContext, async () => {
        const bulk = collection.initializeUnorderedBulkOp();
        bulk
          .find({ title: "Bulk Title" })
          .update({ $set: { title: "Yet Another Title" } });
        await bulk.execute();
      });

      const unorderedBulkFindError = await t.rejects(async () => {
        await runWithContext(unsafeContext, async () => {
          const bulk = collection.initializeUnorderedBulkOp();
          bulk.find({ title: { $ne: null } }).delete();
          await bulk.execute();
        });
      });
      t.ok(unorderedBulkFindError instanceof Error);
      if (unorderedBulkFindError instanceof Error) {
        t.same(
          unorderedBulkFindError.message,
          "Zen has blocked a NoSQL injection: MongoDB.Collection.find(...) originating from body.myTitle"
        );
      }
    } catch (error: any) {
      t.fail(error.message);
    } finally {
      await client.close();
    }
  });
}
