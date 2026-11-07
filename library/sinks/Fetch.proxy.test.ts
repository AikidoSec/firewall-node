/* oxlint-disable no-console */
import * as t from "tap";
import { Agent, ProxyAgent } from "undici-v6";
import { createTestAgent } from "../helpers/createTestAgent";
import { colorText } from "../helpers/colorText";
import { warnBox } from "../helpers/warnBox";
import { Fetch } from "./Fetch";

t.test(
  "fetch warns when its effective global dispatcher changes to a proxy",
  async (t) => {
    const agent = createTestAgent();
    const sink = new Fetch();
    const direct = new Agent();
    const proxy = new ProxyAgent("http://secret:password@localhost:1234");
    const globals = globalThis as unknown as Record<symbol, unknown>;
    const symbol1 = Symbol.for("undici.globalDispatcher.1");
    const symbol2 = Symbol.for("undici.globalDispatcher.2");
    const original1 = globals[symbol1];
    const original2 = globals[symbol2];
    const originalWarn = console.warn;
    const warnings: string[] = [];
    console.warn = (message: string) => warnings.push(message);
    try {
      globals[symbol1] = proxy;
      globals[symbol2] = undefined;
      sink.inspectFetch(["https://example.com", { dispatcher: direct }], agent);
      t.same(warnings, [], "explicit direct dispatcher overrides global proxy");

      globals[symbol1] = direct;
      sink.inspectFetch(["https://example.com"], agent);
      t.same(warnings, [], "direct global dispatcher does not warn");

      globals[symbol2] = proxy;
      sink.inspectFetch(["https://example.com"], agent);
      sink.inspectFetch(["https://example.com", { dispatcher: proxy }], agent);
      t.same(warnings, [
        colorText(
          "red",
          warnBox(
            "Zen cannot guarantee full SSRF protection for requests routed through an outbound proxy. The proxy can resolve destination hostnames to IP addresses that Zen cannot inspect. Configure your proxy to block access to private networks and cloud metadata endpoints."
          )
        ),
      ]);
    } finally {
      console.warn = originalWarn;
      globals[symbol1] = original1;
      globals[symbol2] = original2;
      await direct.close();
      await proxy.close();
    }
  }
);
