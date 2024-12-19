import * as t from "tap";
import { getContext, runWithContext } from "../agent/Context";
import { FastXmlParser } from "./FastXmlParser";
import { createTestAgent } from "../helpers/createTestAgent";

t.test("it works", async () => {
  const agent = createTestAgent();

  agent.start([new FastXmlParser()]);

  const { XMLParser } = require("fast-xml-parser");

  const xmlString = "<root>Hello xml2js!</root>";

  const parser = new XMLParser();
  const result = parser.parse(xmlString);
  t.same(result, { root: "Hello xml2js!" });

  const context = {
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

  runWithContext(context, () => {
    const result = parser.parse(xmlString);
    t.same(result, { root: "Hello xml2js!" });
    t.same(getContext()?.xml, { root: "Hello xml2js!" });
  });
});
