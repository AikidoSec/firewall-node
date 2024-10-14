import { join } from "path";
import * as t from "tap";
import { getContext, runWithContext } from "../agent/Context";
import { XmlMinusJs } from "./XmlMinusJs";
import { readFile } from "fs/promises";
import { createTestAgent } from "../helpers/createTestAgent";

t.test("xml2js works", async () => {
  const agent = createTestAgent();

  agent.start([new XmlMinusJs()]);

  const xmljs = require("xml-js");

  const xmlString = (
    await readFile(join(__dirname, "fixtures", "products.xml"), "utf8")
  ).toString();

  const result = xmljs.xml2js(xmlString);
  const expected = require(join(__dirname, "fixtures", "xml2js.json"));
  t.same(result, expected);

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

  const expectedCompact = require(
    join(__dirname, "fixtures", "xml2js.compact.json")
  );

  runWithContext(context, () => {
    const result = xmljs.xml2js(xmlString, { compact: true });
    t.same(result, expectedCompact);
    t.same(getContext()?.xml, expectedCompact);
  });
});

t.test("xml2json works", async () => {
  const agent = createTestAgent();

  agent.start([new XmlMinusJs()]);

  const xmljs = require("xml-js");

  const xmlString = "<root>Hello xml-js!</root>";

  const result = xmljs.xml2json(xmlString);
  t.same(
    result,
    '{"elements":[{"type":"element","name":"root","elements":[{"type":"text","text":"Hello xml-js!"}]}]}'
  );

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
    const result = xmljs.xml2json(xmlString, { compact: true });
    t.same(result, '{"root":{"_text":"Hello xml-js!"}}');
    t.same(getContext()?.xml, { root: { _text: "Hello xml-js!" } });
  });
});

t.test("Ignore if xml is not in the body", async () => {
  const agent = createTestAgent();
  agent.start([new XmlMinusJs()]);

  const xmljs = require("xml-js");

  const xmlString = "<root>Hello xml-js!</root>";

  const context = {
    remoteAddress: "::1",
    method: "POST",
    url: "http://localhost:4000",
    query: {},
    headers: {},
    body: "Not xml",
    cookies: {},
    routeParams: {},
    source: "express",
    route: "/posts/:id",
  };

  runWithContext(context, () => {
    const result = xmljs.xml2js(xmlString, { compact: true });
    t.same(result, { root: { _text: "Hello xml-js!" } });
    t.same(getContext()?.xml, undefined);
  });
});
