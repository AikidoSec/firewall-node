import * as t from "tap";
import { getRawNodeRequest } from "./getRawRequest";
import type { Context as HonoContext } from "hono";

t.test("returns undefined when c.env is undefined", async (t) => {
  const mockContext = {} as HonoContext;
  t.equal(getRawNodeRequest(mockContext), undefined);
});
