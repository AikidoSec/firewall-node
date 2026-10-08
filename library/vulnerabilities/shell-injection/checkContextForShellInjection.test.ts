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
        route: "/",
      },
    }),
    {
      operation: "child_process.exec",
      kind: "shell_injection",
      source: "body",
      pathsToPayload: [".domain"],
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
        route: "/",
      },
    }),
    {
      operation: "child_process.exec",
      kind: "shell_injection",
      source: "routeParams",
      pathsToPayload: [".domain"],
      metadata: {
        command: "binary --domain www.example`whoami`.com",
      },
      payload: "www.example`whoami`.com",
    }
  );
});

t.test("pentest finding: quote adjacency bypass is detected", async () => {
  // Core vulnerability case from pentest
  const result = checkContextForShellInjection({
    command: "echo 'prefix';id;'suffix'",
    operation: "child_process.exec",
    context: {
      cookies: {},
      headers: {},
      remoteAddress: "ip",
      method: "POST",
      url: "url",
      query: {},
      body: {
        userInput: ";id;",
      },
      routeParams: {},
      source: "express",
      route: "/",
    },
  });
  
  t.ok(result, "Should detect shell injection");
  t.equal(result?.kind, "shell_injection");
  t.equal(result?.payload, ";id;");
  t.equal(result?.source, "body");
});

t.test("pentest finding: various quote adjacency patterns are detected", async () => {
  // Test with different command separators
  const testCases = [
    { command: "echo 'prefix';whoami;'suffix'", payload: ";whoami;" },
    { command: `echo "prefix";id;"suffix"`, payload: ";id;" },
    { command: "echo 'a'; rm -rf /; 'b'", payload: "; rm -rf /; " },
    { command: "cat 'file1';cat /etc/passwd;'file2'", payload: ";cat /etc/passwd;" },
    { command: "echo 'x'&&id&&'y'", payload: "&&id&&" },
    { command: "echo 'x'||whoami||'y'", payload: "||whoami||" },
  ];
  
  for (const testCase of testCases) {
    const result = checkContextForShellInjection({
      command: testCase.command,
      operation: "child_process.exec",
      context: {
        cookies: {},
        headers: {},
        remoteAddress: "ip",
        method: "POST",
        url: "url",
        query: {
          input: testCase.payload,
        },
        body: {},
        routeParams: {},
        source: "express",
        route: "/",
      },
    });
    
    t.ok(result, `Should detect injection in: ${testCase.command}`);
    t.equal(result?.kind, "shell_injection");
    t.equal(result?.payload, testCase.payload);
  }
});

t.test("properly quoted input does not trigger false positives", async () => {
  // These should NOT be detected as shell injection
  const safeCases = [
    { command: "echo ';id;'", payload: ";id;" },
    { command: `echo ";id;"`, payload: ";id;" },
    { command: "echo 'prefix;id;suffix'", payload: ";id;" },
    { command: `echo "prefix;id;suffix"`, payload: ";id;" },
  ];
  
  for (const testCase of safeCases) {
    const result = checkContextForShellInjection({
      command: testCase.command,
      operation: "child_process.exec",
      context: {
        cookies: {},
        headers: {},
        remoteAddress: "ip",
        method: "POST",
        url: "url",
        query: {
          input: testCase.payload,
        },
        body: {},
        routeParams: {},
        source: "express",
        route: "/",
      },
    });
    
    t.notOk(result, `Should NOT detect injection in: ${testCase.command}`);
  }
});
