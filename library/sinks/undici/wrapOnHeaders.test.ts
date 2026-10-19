import * as t from "tap";
import { Context } from "../../agent/Context";
import { wrapOnHeaders, wrapOnResponseStart } from "./wrapOnHeaders";

function createContext(): Context {
  return {
    remoteAddress: "1.2.3.4",
    method: "POST",
    url: "http://localhost:4000",
    query: {},
    headers: {},
    body: {
      image: "http://attacker.example.com/redirect",
    },
    cookies: {},
    routeParams: {},
    source: "express",
    route: "/posts/:id",
  };
}

function createRequestContext() {
  return {
    url: new URL("http://attacker.example.com/redirect"),
    port: 80,
  };
}

function callOnHeaders(
  onHeaders: ReturnType<typeof wrapOnHeaders>,
  statusCode: number,
  headers: Buffer[]
) {
  if (!onHeaders) {
    throw new Error("onHeaders is not defined");
  }
  onHeaders(statusCode, headers, () => {}, "");
}

t.test("wrapOnHeaders records the hop for an absolute Location", async (t) => {
  const context = createContext();
  const requestContext = createRequestContext();

  const onHeaders = wrapOnHeaders(undefined, requestContext, context);
  callOnHeaders(onHeaders, 302, [
    Buffer.from("location"),
    Buffer.from("http://127.0.0.1/secret"),
  ]);

  t.same(context.outgoingRequestRedirects, [
    {
      source: requestContext.url,
      destination: new URL("http://127.0.0.1/secret"),
    },
  ]);
});

t.test(
  "wrapOnHeaders records the hop for a protocol-relative Location",
  async (t) => {
    const context = createContext();
    const requestContext = createRequestContext();

    const onHeaders = wrapOnHeaders(undefined, requestContext, context);
    callOnHeaders(onHeaders, 302, [
      Buffer.from("location"),
      Buffer.from("//127.0.0.1/secret"),
    ]);

    t.same(context.outgoingRequestRedirects, [
      {
        source: requestContext.url,
        destination: new URL("http://127.0.0.1/secret"),
      },
    ]);
  }
);

t.test("wrapOnHeaders records the hop for a relative Location", async (t) => {
  const context = createContext();
  const requestContext = createRequestContext();

  const onHeaders = wrapOnHeaders(undefined, requestContext, context);
  callOnHeaders(onHeaders, 302, [
    Buffer.from("location"),
    Buffer.from("/secret"),
  ]);

  t.same(context.outgoingRequestRedirects, [
    {
      source: requestContext.url,
      destination: new URL("http://attacker.example.com/secret"),
    },
  ]);
});

t.test(
  "wrapOnHeaders does not record a relative Location without a request context",
  async (t) => {
    const context = createContext();

    const onHeaders = wrapOnHeaders(undefined, undefined, context);
    callOnHeaders(onHeaders, 302, [
      Buffer.from("location"),
      Buffer.from("/secret"),
    ]);

    t.same(context.outgoingRequestRedirects, undefined);
  }
);

t.test("wrapOnHeaders still calls the original handler", async (t) => {
  const context = createContext();
  const requestContext = createRequestContext();

  let called = false;
  const orig = (...args: unknown[]) => {
    called = true;
    t.same(args[0], 302);
  };

  const onHeaders = wrapOnHeaders(orig as never, requestContext, context);
  callOnHeaders(onHeaders, 302, [
    Buffer.from("location"),
    Buffer.from("//127.0.0.1/secret"),
  ]);

  t.ok(called);
});

t.test(
  "wrapOnResponseStart records the hop for an absolute Location",
  async (t) => {
    const context = createContext();
    const requestContext = createRequestContext();

    const onResponseStart = wrapOnResponseStart(
      undefined,
      requestContext,
      context
    );
    // @ts-expect-error Not testing the controller argument
    onResponseStart(undefined, 302, {
      location: "http://127.0.0.1/secret",
    });

    t.same(context.outgoingRequestRedirects, [
      {
        source: requestContext.url,
        destination: new URL("http://127.0.0.1/secret"),
      },
    ]);
  }
);

t.test(
  "wrapOnResponseStart records the hop for a protocol-relative Location",
  async (t) => {
    const context = createContext();
    const requestContext = createRequestContext();

    const onResponseStart = wrapOnResponseStart(
      undefined,
      requestContext,
      context
    );
    // @ts-expect-error Not testing the controller argument
    onResponseStart(undefined, 302, {
      location: "//127.0.0.1/secret",
    });

    t.same(context.outgoingRequestRedirects, [
      {
        source: requestContext.url,
        destination: new URL("http://127.0.0.1/secret"),
      },
    ]);
  }
);

t.test(
  "wrapOnResponseStart records the hop for a relative Location",
  async (t) => {
    const context = createContext();
    const requestContext = createRequestContext();

    const onResponseStart = wrapOnResponseStart(
      undefined,
      requestContext,
      context
    );
    // @ts-expect-error Not testing the controller argument
    onResponseStart(undefined, 302, {
      location: "/secret",
    });

    t.same(context.outgoingRequestRedirects, [
      {
        source: requestContext.url,
        destination: new URL("http://attacker.example.com/secret"),
      },
    ]);
  }
);

t.test(
  "wrapOnResponseStart does not record a relative Location without a request context",
  async (t) => {
    const context = createContext();

    const onResponseStart = wrapOnResponseStart(undefined, undefined, context);
    // @ts-expect-error Not testing the controller argument
    onResponseStart(undefined, 302, {
      location: "/secret",
    });

    t.same(context.outgoingRequestRedirects, undefined);
  }
);

t.test("wrapOnResponseStart still calls the original handler", async (t) => {
  const context = createContext();
  const requestContext = createRequestContext();

  let called = false;
  const orig = (...args: unknown[]) => {
    called = true;
    t.same(args[1], 302);
  };

  const onResponseStart = wrapOnResponseStart(
    orig as never,
    requestContext,
    context
  );
  // @ts-expect-error Not testing the controller argument
  onResponseStart(undefined, 302, { location: "//127.0.0.1/secret" });

  t.ok(called);
});
