import * as t from "tap";
import { Agent } from "../agent/Agent";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import { getContext, runWithContext } from "../agent/Context";
import { LoggerNoop } from "../agent/logger/LoggerNoop";
import { XmlMinusJs } from "./XmlMinusJs";

t.test("xml2js works", async () => {
  const agent = new Agent(
    true,
    new LoggerNoop(),
    new ReportingAPIForTesting(),
    undefined,
    undefined
  );

  agent.start([new XmlMinusJs()]);

  const xmljs = require("xml-js");

  const xmlString = "<root>Hello xml-js!</root>";

  const result = xmljs.xml2js(xmlString);
  t.same(result, {
    elements: [
      {
        type: "element",
        name: "root",
        elements: [{ type: "text", text: "Hello xml-js!" }],
      },
    ],
  });

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
    const result = xmljs.xml2js(xmlString, { compact: true });
    t.same(result, { root: { _text: "Hello xml-js!" } });
    t.same(getContext()?.xml, { root: { _text: "Hello xml-js!" } });
  });
});

t.test("xml2json works", async () => {
  const agent = new Agent(
    true,
    new LoggerNoop(),
    new ReportingAPIForTesting(),
    undefined,
    undefined
  );

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
