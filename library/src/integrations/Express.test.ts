import * as t from "tap";
import { Aikido } from "../Aikido";
import { APIForTesting } from "../API";
import { LoggerNoop } from "../Logger";
import { Express } from "./Express";

// Before express is required!
new Express(
  new Aikido(new LoggerNoop(), new APIForTesting(), undefined)
).setup();

import * as express from "express";
import * as request from "supertest";
import * as cookieParser from "cookie-parser";
import { getContext } from "../RequestContext";

function getApp() {
  const app = express();

  app.set("trust proxy", true);
  app.use(cookieParser());

  app.get("/", (req, res) => {
    const context = getContext();

    res.send(context);
  });

  app.post("/", express.json(), (req, res) => {
    const context = getContext();

    res.send(context);
  });

  app.route("/route").get((req, res) => {
    const context = getContext();

    res.send(context);
  });

  app.all("/all", (req, res) => {
    const context = getContext();

    res.send(context);
  });

  return app;
}

t.test("it adds context from request for GET", async (t) => {
  const response = await request(getApp())
    .get("/?title[$ne]=null")
    .set("Cookie", "session=123")
    .set("Accept", "application/json")
    .set("X-Forwarded-For", "1.2.3.4");

  t.match(response.body.request, {
    query: { title: { $ne: "null" } },
    cookies: { session: "123" },
    headers: { accept: "application/json", cookie: "session=123" },
    remoteAddress: "1.2.3.4",
  });
});

t.test("it adds context from request for POST", async (t) => {
  const response = await request(getApp()).post("/").send({ title: "Title" });

  t.match(response.body.request.body, { title: "Title" });
});

t.test("it adds context from request for route", async (t) => {
  const response = await request(getApp()).get("/route");

  t.match(response.body.request, {
    query: {},
    cookies: {},
    headers: {},
  });
});

t.test("it adds context from request for all", async (t) => {
  const response = await request(getApp()).get("/all");

  t.match(response.body.request, {
    query: {},
    cookies: {},
    headers: {},
  });
});
