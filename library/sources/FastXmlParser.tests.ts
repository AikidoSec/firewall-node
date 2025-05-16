import * as t from "tap";
import { getContext, runWithContext } from "../agent/Context";
import { FastXmlParser } from "./FastXmlParser";
import { startTestAgent } from "../helpers/startTestAgent";

export function createFastXmlParserTests(pkgName: string) {
  t.test("it works", async () => {
    startTestAgent({
      serverless: "lambda",
      wrappers: [new FastXmlParser()],
      rewrite: {
        "fast-xml-parser": pkgName,
      },
    });

    const { XMLParser } = require(pkgName);

    const xmlString = "<root>Hello xml2js!</root>";

    const parser = new XMLParser();
    const result = parser.parse(xmlString);
    t.same(result, { root: "Hello xml2js!" });

    const contextWithBody = {
      remoteAddress: "::1",
      method: "POST",
      url: "http://localhost:4000",
      query: {},
      headers: { "content-type": "application/xml" },
      body: xmlString,
      cookies: {},
      routeParams: {},
      source: "express",
      route: "/",
    };

    runWithContext(contextWithBody, () => {
      const result = parser.parse(xmlString);
      t.same(result, { root: "Hello xml2js!" });
      t.same(getContext()?.xml, [{ root: "Hello xml2js!" }]);
    });

    const xmlString2 =
      '<root><list><person name="John"><age>35</age></person></list></root>';

    const contextWithQuery = {
      remoteAddress: "::1",
      method: "GET",
      headers: {},
      url: "http://localhost:4000",
      query: {
        xml: xmlString2,
      },
      body: undefined,
      cookies: {},
      routeParams: {},
      source: "express",
      route: "/",
    };

    // Ignores if xml string not in the context
    runWithContext(contextWithQuery, () => {
      const result = parser.parse(xmlString);
      t.same(result, { root: "Hello xml2js!" });
      t.same(getContext()?.xml, undefined);
    });

    runWithContext(contextWithQuery, () => {
      const parser2 = new XMLParser({
        ignoreAttributes: false,
      });

      const result = parser2.parse(xmlString2);

      const expected = {
        root: {
          list: {
            person: {
              age: 35,
              "@_name": "John",
            },
          },
        },
      };

      t.same(result, expected);
      t.same(getContext()?.xml, [expected]);

      // Adds additional xml to the context xml array
      parser2.parse(xmlString2);

      t.same(getContext()?.xml, [expected, expected]);
    });

    // XML is not in the context
    runWithContext({ ...contextWithQuery, query: {}, xml: undefined }, () => {
      const res = parser.parse(xmlString);
      t.same(res, { root: "Hello xml2js!" });
      t.same(getContext()?.xml, undefined);
    });

    // Zen ignores non string values
    t.same(parser.parse(123), {});
  });
}
