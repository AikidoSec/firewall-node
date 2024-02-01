import * as t from "tap";
import { APIForTesting, APIThrottled, Token, Event } from "./API";

t.test("APIThrottled", async (t) => {
  const actualAPI = new APIForTesting();
  const api = new APIThrottled(actualAPI);
  t.match(actualAPI.getEvents(), []);

  const blocked1: Event = {
    type: "blocked",
    kind: "nosql-injection",
    url: "https://example.com",
    source: "query",
    path: "search",
    hostname: "hostname",
    ipAddress: "1.2.3.4",
    method: "GET",
    userAgent: "user-agent",
    version: "1.0.0",
    stack: "ERROR ERROR ERROR",
    metadata: {
      collection: "collection",
      filter: "filter",
    },
  };

  await api.report(new Token("123"), blocked1);
  t.match(actualAPI.getEvents(), [blocked1]);

  // Same event should not be reported again
  await api.report(new Token("123"), blocked1);
  t.match(actualAPI.getEvents(), [blocked1]);

  const blocked2: Event = {
    ...blocked1,
    stack: "ANOTHER STACK",
    version: "1.0.1",
    hostname: "another-hostname",
  };

  // The properties above are not part of the fingerprint
  await api.report(new Token("123"), blocked2);
  t.match(actualAPI.getEvents(), [blocked1]);

  const blocked3: Event = {
    ...blocked1,
    path: "another-path",
  };

  await api.report(new Token("123"), blocked3);
  t.match(actualAPI.getEvents(), [blocked1, blocked3]);
});
