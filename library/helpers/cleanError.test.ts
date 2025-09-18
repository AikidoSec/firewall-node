import * as t from "tap";
import { cleanError } from "./cleanError";

t.test(
  "it works",
  {
    skip: process.env.IS_ESM_TEST
      ? "ESM tests are executed in a different context"
      : false,
  },
  async () => {
    const error = new Error("test");
    t.same(error.message, "test");
    t.same(error.name, "Error");
    t.same(error.stack!.includes("cleanError.test.ts"), true);

    const cleaned = cleanError(new Error("test"));
    t.same(cleaned.message, "test");
    t.same(cleaned.name, "Error");
    t.same(cleaned.stack!.includes("cleanError.test.ts"), false);

    const cleaned2 = cleanError(new TypeError("test2"));
    t.same(cleaned2.message, "test2");
    t.same(cleaned2.name, "TypeError");
    t.same(cleaned2.stack!.includes("cleanError.test.ts"), false);
  }
);
