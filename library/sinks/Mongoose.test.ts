import * as t from "tap";
import { Mongoose as MongooseSink } from "./Mongoose";
import { startTestAgent } from "../helpers/startTestAgent";
import { getContext, runWithContext, type Context } from "../agent/Context";
import { MongoDB as MongoDBSink } from "./MongoDB";

const dbUrl =
  "mongodb://root:password@127.0.0.1:27020/mongoose?authSource=admin&directConnection=true";

function getTestContext(body: unknown): Context {
  return {
    remoteAddress: "::1",
    method: "POST",
    url: "http://localhost:4000",
    query: {},
    headers: {},
    body: body,
    cookies: {},
    routeParams: {},
    source: "hono",
    route: "/posts/:id",
  };
}

t.test("it works", async (t) => {
  startTestAgent({
    block: true,
    wrappers: [new MongooseSink(), new MongoDBSink()],
    rewrite: {},
  });

  const mongoose = require("mongoose") as typeof import("mongoose");

  await mongoose.connect(dbUrl);

  try {
    const Schema = mongoose.Schema;
    const ObjectId = Schema.ObjectId;

    const BlogPostSchema = new Schema({
      author: ObjectId,
      title: String,
      body: String,
      date: Date,
    });

    const BlogPost = mongoose.model("BlogPost", BlogPostSchema);

    const post = new BlogPost({
      title: "Test",
      body: "This is a test",
      date: new Date(),
    });
    await post.save();

    // @ts-expect-error Pass string instead of array
    const foundPost = await BlogPost.findOne({ title: { $in: "Test" } });
    t.match(foundPost?.title, "Test");
    t.match(foundPost?.body, "This is a test");

    await runWithContext(getTestContext({ foo: "bar" }), async () => {
      // @ts-expect-error Pass string instead of array
      const foundPost2 = await BlogPost.findOne({ title: { $in: "Test" } });
      t.match(foundPost2?.title, "Test");
      t.match(foundPost2?.body, "This is a test");

      t.same(getContext()?.notNormalizedNoSqlFilter, {
        title: { $in: "Test" },
      });
    });

    await runWithContext(
      getTestContext({ title: { $in: "Test" } }),
      async () => {
        const error = await t.rejects(async () => {
          // @ts-expect-error Pass string instead of array
          await BlogPost.findOne({ title: { $in: "Test" } });
        });
        t.ok(error instanceof Error);
        if (error instanceof Error) {
          t.match(
            error.message,
            "Zen has blocked a NoSQL injection: MongoDB.Collection.findOne(...) originating from body.title"
          );
        }
      }
    );

    await runWithContext(
      getTestContext({ title: { $nin: "Test" } }),
      async () => {
        const error = await t.rejects(async () => {
          await BlogPost.find({
            // @ts-expect-error Pass string instead of array
            title: { $nin: "Test" },
          });
        });
        t.ok(error instanceof Error);
        if (error instanceof Error) {
          t.match(
            error.message,
            "Zen has blocked a NoSQL injection: MongoDB.Collection.find(...) originating from body.title"
          );
        }
      }
    );

    await runWithContext(
      getTestContext({ title: { $all: "Test" } }),
      async () => {
        const error = await t.rejects(async () => {
          await BlogPost.find({
            // @ts-expect-error Pass string instead of array
            title: { $all: "Test" },
          });
        });
        t.ok(error instanceof Error);
        if (error instanceof Error) {
          t.match(
            error.message,
            "Zen has blocked a NoSQL injection: MongoDB.Collection.find(...) originating from body.title"
          );
        }
      }
    );

    await runWithContext(
      getTestContext({ title: { $all: ["Test1", "Test2"] } }),
      async () => {
        const error = await t.rejects(async () => {
          await BlogPost.find({
            title: { $all: ["Test1", "Test2"] },
          });
        });
        t.ok(error instanceof Error);
        if (error instanceof Error) {
          t.match(
            error.message,
            "Zen has blocked a NoSQL injection: MongoDB.Collection.find(...) originating from body.title"
          );
        }
      }
    );

    // Does not throw because context does not match
    await runWithContext(getTestContext({ title: "123" }), async () => {
      await BlogPost.find({
        // @ts-expect-error Pass string instead of array
        title: { $all: "Test" },
      });
    });

    await runWithContext(getTestContext({ $exists: "true" }), async () => {
      const error = await t.rejects(async () => {
        await BlogPost.find({
          // @ts-expect-error Pass string instead of boolean
          title: { $exists: "true" },
        });
      });
      t.ok(error instanceof Error);
      if (error instanceof Error) {
        t.match(
          error.message,
          "Zen has blocked a NoSQL injection: MongoDB.Collection.find(...) originating from body"
        );
      }
    });
  } catch (err: any) {
    t.fail(err);
  } finally {
    await mongoose.disconnect();
  }
});
