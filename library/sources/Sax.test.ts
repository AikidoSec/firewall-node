import * as t from "tap";
import { Agent } from "../agent/Agent";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import {
  Context,
  getContext,
  runWithContext,
  updateContext,
} from "../agent/Context";
import { LoggerNoop } from "../agent/logger/LoggerNoop";
import { Sax } from "./Sax";
import { Readable } from "stream";

const context: Context = {
  remoteAddress: "::1",
  method: "POST",
  url: "http://localhost:4000",
  query: {},
  headers: {},
  body: '<root><child name="test">text</child><child>13</child></root>',
  cookies: {},
  routeParams: {},
  source: "express",
  route: "/posts/:id",
};

t.test("it works", async (t) => {
  const agent = new Agent(
    true,
    new LoggerNoop(),
    new ReportingAPIForTesting(),
    undefined,
    undefined
  );

  agent.start([new Sax()]);

  const sax = require("sax");

  let parser1Text = "";
  const parser1 = sax.parser(true);
  parser1.ontext = function onTxt(txt) {
    parser1Text += txt;
  };
  parser1.onend = function onEnd() {
    t.equal(parser1Text, "text13");
  };

  parser1.write('<root><child name="test">text</child><child>');
  parser1.write("13</child></root>").close();

  runWithContext(context, () => {
    let text = "";
    const parser = sax.parser(true);
    parser.ontext = function onText(txt) {
      text += txt;
    };
    parser.onend = function onEnd() {
      t.equal(text, "text13");
    };

    t.same(getContext()?.xml, undefined);

    parser.write('<root><child name="test">text</child><child>');
    t.same(getContext()?.xml, ["text"]);
    parser.write("13</child></root>").close();
    t.same(getContext()?.xml, ["text", "13"]);
  });

  // Reset the context
  updateContext(context, "xml", undefined);

  runWithContext(context, () => {
    const attrs: { name: string; value: any }[] = [];
    const parser = sax.parser(true);
    parser.onattribute = function onAttr(attr) {
      attrs.push(attr);
    };
    parser.onend = function onEnd() {
      t.same(attrs, [{ name: "name", value: "test" }]);
    };

    t.same(getContext()?.xml, undefined);

    parser.write('<root><child name="test">text</child><child>');
    t.same(getContext()?.xml, [{ name: "name", value: "test" }]);
    parser.write("13</child></root>").close();
    t.same(getContext()?.xml, [{ name: "name", value: "test" }]);
  });

  // Reset the context
  updateContext(context, "xml", "existing");

  runWithContext(context, () => {
    let text = "";
    const parser = sax.parser(true);
    parser.ontext = function onText(txt) {
      text += txt;
    };
    parser.onend = function onEnd() {
      t.equal(text, "textnot in body13");
    };

    t.same(getContext()?.xml, "existing");

    parser.write('<root><child name="test">text</child><child>');
    t.same(getContext()?.xml, ["existing", "text"]);
    parser.write("not in body</child>");
    t.same(getContext()?.xml, ["existing", "text"]);
    parser.write("<child>13</child></root>").close();
    t.same(getContext()?.xml, ["existing", "text", "13"]);
  });

  // Reset the context
  updateContext(context, "xml", undefined);

  runWithContext(context, () => {
    let text = "";
    const parser = sax.parser(true);
    parser.ontext = function onText(txt) {
      text += txt;
    };
    parser.onend = function onEnd() {
      t.equal(text, "text");
    };

    t.same(getContext()?.xml, undefined);
    parser.write(['<root><child name="test">text</child><child>']).close();
    t.same(getContext()?.xml, ["text"]);
  });

  // Reset the context
  updateContext(context, "xml", undefined);

  runWithContext(context, () => {
    let text = "";
    const parser = sax.parser(true);
    parser.ontext = function onText(txt) {
      text += txt;
    };
    parser.onend = function onEnd() {
      t.equal(text, "");
    };

    t.same(getContext()?.xml, undefined);
    parser.write(true).close();
    t.same(getContext()?.xml, undefined);
  });
});

t.test("it works with streams", (t) => {
  const agent = new Agent(
    true,
    new LoggerNoop(),
    new ReportingAPIForTesting(),
    undefined,
    undefined
  );

  agent.start([new Sax()]);

  const sax = require("sax");

  // Reset the context
  updateContext(context, "xml", undefined);

  runWithContext(context, () => {
    let text = "";
    const saxStream = sax.createStream(true);
    saxStream.on("text", function onTxt(txt) {
      text += txt;
    });

    t.same(getContext()?.xml, undefined);

    const inputStream = new Readable();
    inputStream.pipe(saxStream);
    inputStream.push('<root><child name="test">text</child><child>');
    inputStream.push("13</child></root>");
    inputStream.push(null);

    saxStream.on("end", function onEnd() {
      t.equal(text, "text13");
      t.same(getContext()?.xml, ["text", "13"]);
      t.end();
    });
  });
});
