import * as t from "tap";
import { Context, getContext, runWithContext } from "../agent/Context";
import { Xml2js } from "./Xml2js";
import { createTestAgent } from "../helpers/createTestAgent";

t.test("it works", async () => {
  const agent = createTestAgent();
  agent.start([new Xml2js()]);

  const { parseStringPromise, parseString } =
    require("xml2js") as typeof import("xml2js");

  const xmlString = "<root>Hello xml2js!</root>";

  const result = await parseStringPromise(xmlString);
  t.same(result, { root: "Hello xml2js!" });

  parseString(xmlString, (err, result) => {
    t.same(result, { root: "Hello xml2js!" });
    t.same(getContext()?.xml, undefined);
  });

  const context: Context = {
    remoteAddress: "::1",
    method: "POST",
    url: "http://localhost:4000",
    query: {},
    headers: {},
    body: xmlString,
    cookies: {},
    routeParams: {},
    source: "express",
    route: "/posts/:id",
  };

  await runWithContext(context, async () => {
    const result = await parseStringPromise(xmlString);
    t.same(result, { root: "Hello xml2js!" });
    t.same(getContext()?.xml, { root: "Hello xml2js!" });
  });

  runWithContext(context, () => {
    parseString(xmlString, (err, result) => {
      t.same(result, { root: "Hello xml2js!" });
      t.same(getContext()?.xml, { root: "Hello xml2js!" });
    });
  });
});
