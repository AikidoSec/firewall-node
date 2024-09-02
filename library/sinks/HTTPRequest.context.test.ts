/* eslint-disable prefer-rest-params */
import * as t from "tap";
import { Agent } from "../agent/Agent";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import { Token } from "../agent/api/Token";
import { Context, getContext, runWithContext } from "../agent/Context";
import { LoggerNoop } from "../agent/logger/LoggerNoop";
import { HTTPRequest } from "./HTTPRequest";

const source =
  "http://firewallssrfredirects-env-2.eba-7ifve22q.eu-north-1.elasticbeanstalk.com/ssrf-test";
const destination = "http://127.0.0.1/test";

const context: Context = {
  remoteAddress: "::1",
  method: "POST",
  url: "http://localhost:4000",
  query: {},
  headers: {},
  body: {
    image: source,
  },
  cookies: {},
  routeParams: {},
  source: "express",
  route: "/posts/:id",
};

t.test("it wraps ", (t) => {
  const agent = new Agent(
    true,
    new LoggerNoop(),
    new ReportingAPIForTesting(),
    new Token("123"),
    undefined
  );
  agent.start([new HTTPRequest()]);

  const http = require("http");

  runWithContext(context, () => {
    const request = http.request(source, (res) => {
      res.on("data", () => {});
    });

    request.on("response", (res) => {
      t.same(
        getContext().outgoingRequestRedirects.map((r) => ({
          source: r.source.toString(),
          destination: r.destination.toString(),
        })),
        [
          {
            source: source,
            destination: destination,
          },
        ]
      );
      t.end();
    });

    request.on("error", (e) => {
      t.fail(e);
      t.end();
    });

    request.end();
  });
});
