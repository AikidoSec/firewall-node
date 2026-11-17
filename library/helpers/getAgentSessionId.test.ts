import * as t from "tap";
import { getAgentSessionId } from "./getAgentSessionId";

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

t.test("it returns a valid UUID", async (t) => {
  t.match(getAgentSessionId(), uuidRegex);
});

t.test("it returns the same value on every call", async (t) => {
  t.equal(getAgentSessionId(), getAgentSessionId());
});
