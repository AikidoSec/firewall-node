import * as t from "tap";
import { Agent } from "../agent/Agent";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import { Context, getContext, runWithContext } from "../agent/Context";
import { LoggerNoop } from "../agent/logger/LoggerNoop";
import { Xml2js } from "./Xml2js";

t.test("it works", async () => {
  const agent = new Agent(
    true,
    new LoggerNoop(),
    new ReportingAPIForTesting(),
    undefined,
    undefined
  );

  agent.start([new Xml2js()]);

  const { parseStringPromise, parseString } = require("xml2js");

  const xmlString = "<root>Hello xml2js!</root>";

  const result = await parseStringPromise(xmlString);
  t.same(result, { root: "Hello xml2js!" });

  parseString(xmlString, (err, result) => {
    t.same(result, { root: "Hello xml2js!" });
    t.same(getContext()?.xml, undefined);
  });

  const getTestContext = (): Context => {
    return {
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
  };

  await runWithContext(getTestContext(), async () => {
    const result = await parseStringPromise(xmlString);
    t.same(result, { root: "Hello xml2js!" });
    t.same(getContext()?.xml, [{ root: "Hello xml2js!" }]);
  });

  const sharedContext = getTestContext();

  runWithContext(sharedContext, () => {
    parseString(xmlString, (err, result) => {
      t.same(result, { root: "Hello xml2js!" });
      t.same(getContext()?.xml, [{ root: "Hello xml2js!" }]);
    });
  });

  // Adds addition xml to the context xml array
  runWithContext(sharedContext, () => {
    parseString(xmlString, (err, result) => {
      t.same(result, { root: "Hello xml2js!" });
      t.same(getContext()?.xml, [
        { root: "Hello xml2js!" },
        { root: "Hello xml2js!" },
      ]);
    });
  });

  // Ignore xml not in the context
  runWithContext(getTestContext(), () => {
    parseString("<test><ele>ABC</ele></test>", (err, result) => {
      t.same(result, { test: { ele: ["ABC"] } });
      t.same(getContext()?.xml, undefined);
    });
  });
});
