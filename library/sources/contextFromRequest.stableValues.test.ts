import type { IncomingMessage } from "http";
import type { Request } from "express";
import * as t from "tap";
import { contextFromRequest as expressContextFromRequest } from "./express/contextFromRequest";
import { contextFromRequest as httpContextFromRequest } from "./http-server/contextFromRequest";

type TestRequest = IncomingMessage &
  Request & {
    socket: { remoteAddress: string | undefined };
  };

type Extractor = (req: TestRequest) => {
  route: string | undefined;
  remoteAddress: string | undefined;
};

function createRequest(): TestRequest {
  const headers: Record<string, string> = {
    host: "example.test",
    "x-forwarded-for": "1.2.3.4",
  };

  return {
    method: "GET",
    url: "/users/123?hello=world",
    originalUrl: "/users/123?hello=world",
    protocol: "https",
    headers,
    socket: { remoteAddress: "127.0.0.1" },
    body: undefined,
    query: {},
    params: {},
    cookies: {},
    subdomains: [],
    get(name: string) {
      return headers[name.toLowerCase()];
    },
  } as unknown as TestRequest;
}

const http: Extractor = (req) => httpContextFromRequest(req, undefined, "http");
const express: Extractor = (req) => expressContextFromRequest(req);

for (const [name, firstExtractor, secondExtractor] of [
  ["http then express", http, express],
  ["express then http", express, http],
] as const) {
  t.test(`it keeps request values stable (${name})`, async (t) => {
    const req = createRequest();
    const first = firstExtractor(req);

    req.url = "/admins/550e8400-e29b-41d4-a716-446655440000";
    req.originalUrl = req.url;
    req.headers["x-forwarded-for"] = "5.6.7.8";
    req.socket.remoteAddress = "10.0.0.1";

    const second = secondExtractor(req);

    t.same(first.route, "/users/:number");
    t.same(second.route, first.route);
    t.same(first.remoteAddress, "1.2.3.4");
    t.same(second.remoteAddress, first.remoteAddress);
  });
}
