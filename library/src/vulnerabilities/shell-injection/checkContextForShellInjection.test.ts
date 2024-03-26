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
      },
    }),
    {
      operation: "child_process.exec",
      kind: "shell_injection",
      source: "body",
      pathToPayload: ".domain",
      metadata: {},
    }
  );
});
