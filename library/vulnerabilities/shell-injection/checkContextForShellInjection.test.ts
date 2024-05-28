import * as t from "tap";
import { checkContextForShellInjection } from "./checkContextForShellInjection";

t.test("it detects shell injection", async () => {
  t.same(
    checkContextForShellInjection({
      command: "binary --domain www.example`whoami`.com",
      operation: "child_process.exec",
      context: {
        cookies: {},
        headers: {},
        remoteAddress: "ip",
        method: "POST",
        url: "url",
        query: {},
        body: {
          domain: "www.example`whoami`.com",
        },
        routeParams: {},
        source: "express",
        route: "/posts/:id",
      },
    }),
    {
      operation: "child_process.exec",
      kind: "shell_injection",
      source: "body",
      pathToPayload: ".domain",
      metadata: {
        command: "binary --domain www.example`whoami`.com",
      },
      payload: "www.example`whoami`.com",
    }
  );
});

t.test("it detects shell injection from route params", async () => {
  t.same(
    checkContextForShellInjection({
      command: "binary --domain www.example`whoami`.com",
      operation: "child_process.exec",
      context: {
        cookies: {},
        headers: {},
        remoteAddress: "ip",
        method: "POST",
        url: "url",
        query: {},
        body: {},
        routeParams: {
          domain: "www.example`whoami`.com",
        },
        source: "express",
        route: "/posts/:id",
      },
    }),
    {
      operation: "child_process.exec",
      kind: "shell_injection",
      source: "routeParams",
      pathToPayload: ".domain",
      metadata: {
        command: "binary --domain www.example`whoami`.com",
      },
      payload: "www.example`whoami`.com",
    }
  );
});
