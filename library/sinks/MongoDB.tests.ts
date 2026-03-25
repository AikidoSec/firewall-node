import * as t from "tap";
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

      await collection.insertMany([
        { title: "abc" },
        { title: "another title" },
        { title: "yet another title" },
      ]);

      {
        // Confirms that filtering with Maps is possible
        const mapFilter = new Map<string, string>();
        mapFilter.set("title", "abc");
        const mapFilteredDocuments = await collection.find(mapFilter).toArray();
        t.same(
          mapFilteredDocuments.map((document) => document.title),
          ["abc"]
        );

        // Confirms that filtering with nested Maps is possible
        const mapSubFilter = new Map<string, any>();
        mapSubFilter.set("$ne", "abc");
        const mainMapFilter = new Map<string, any>();
        mainMapFilter.set("title", mapSubFilter);
        const mapSubFilteredDocuments = await collection
          .find(mainMapFilter)
          .toArray();
        t.same(
          mapSubFilteredDocuments.map((document) => document.title),
          ["another title", "yet another title"]
        );

        // Confirms that map inside plain object is also working
        const plainObjectWithMapFilter = {
          title: new Map<string, any>([["$ne", "abc"]]),
        };
        const plainObjectWithMapFilteredDocuments = await collection
          .find(plainObjectWithMapFilter)
          .toArray();
        t.same(
          plainObjectWithMapFilteredDocuments.map((document) => document.title),
          ["another title", "yet another title"]
        );
      }

      const mapError = await t.rejects(async () => {
        await runWithContext(unsafeContext, () => {
          const filter = new Map<string, any>();
          filter.set("title", { $ne: null });
          return collection.find(filter).toArray();
        });
      });
      t.ok(mapError instanceof Error);
      if (mapError instanceof Error) {
        t.same(
          mapError.message,
          "Zen has blocked a NoSQL injection: MongoDB.Collection.find(...) originating from body.myTitle"
        );
      }

      const mapError2 = await t.rejects(async () => {
        await runWithContext(
          {
            ...unsafeContext,
            body: {
              title: new Map<string, any>([["$ne", null]]),
            },
          },
          () => {
            const filter = new Map<string, any>();
            filter.set("title", { $ne: null });
            return collection.find(filter).toArray();
          }
        );
      });
      t.ok(mapError2 instanceof Error);
      if (mapError2 instanceof Error) {
        t.same(
          mapError2.message,
          "Zen has blocked a NoSQL injection: MongoDB.Collection.find(...) originating from body.title"
        );
      }

      const mapError3 = await t.rejects(async () => {
        await runWithContext(unsafeContext, () => {
          const filter = {
            title: new Map<string, any>([["$ne", null]]),
          };
          return collection.find(filter).toArray();
        });
      });
      t.ok(mapError3 instanceof Error);
      if (mapError3 instanceof Error) {
        t.same(
          mapError3.message,
          "Zen has blocked a NoSQL injection: MongoDB.Collection.find(...) originating from body.myTitle"
        );
      }

      const mapError4 = await t.rejects(async () => {
        await runWithContext(unsafeContext, () => {
          const filter = new Map<string, any>();
          filter.set("title", new Map<string, any>([["$ne", null]]));
          return collection.find(filter).toArray();
        });
      });
      t.ok(mapError4 instanceof Error);
      if (mapError4 instanceof Error) {
        t.same(
          mapError4.message,
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
