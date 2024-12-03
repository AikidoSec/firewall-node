import * as t from "tap";
import { Context, runWithContext } from "../agent/Context";
import { FileSystem } from "./FileSystem";
import { createTestAgent } from "../helpers/createTestAgent";

const unsafeContext: Context = {
  remoteAddress: "::1",
  method: "POST",
  url: "http://localhost:4000",
  query: {},
  headers: {},
  body: {
    file: {
      matches: "../test.txt",
    },
  },
  cookies: {},
  routeParams: {},
  source: "express",
  route: "/posts/:id",
};

t.test("when require('fs').promises is used", async (t) => {
  const agent = createTestAgent();

  agent.start([new FileSystem()]);

  const { promises } = require("fs");

  await runWithContext(unsafeContext, async () => {
    const error = await t.rejects(() =>
      promises.writeFile(
        "../../test.txt",
        "some other file content to test with",
        { encoding: "utf-8" }
      )
    );
    t.ok(error instanceof Error);
    if (error instanceof Error) {
      t.match(
        error.message,
        "Zen has blocked a path traversal attack: fs.writeFile(...) originating from body.file.matches"
      );
    }
  });
});
