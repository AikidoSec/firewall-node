export const detectedAttackEvent = {
  module: "mongodb",
  kind: "nosql_injection",
  blocked: true,
  source: "body",
  request: {
    method: "POST",
    cookies: {},
    query: {},
    headers: {
      "user-agent": "agent",
    },
    body: {},
    url: "http://localhost:4000",
    remoteAddress: "::1",
    source: "express",
    route: "/posts/:id",
    routeParams: {},
  },
  operation: "operation",
  payload: "payload",
  stack: "stack",
  path: ".nested",
  metadata: {
    db: "app",
  },
};

export const expectedDetectedAttackEvent = {
  type: "detected_attack",
  attack: {
    module: "mongodb",
    kind: "nosql_injection",
    blocked: true,
    source: "body",
    path: ".nested",
    stack: "stack",
    metadata: {
      db: "app",
    },
  },
  request: {
    method: "POST",
    ipAddress: "::1",
    url: "http://localhost:4000",
    headers: {},
    body: "{}",
  },
};
