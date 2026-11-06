import * as t from "tap";
import { Agent as HTTPAgent } from "http";
import { Agent as HTTPSAgent } from "https";
import { HttpProxyAgent } from "http-proxy-agent";
import { HttpsProxyAgent } from "https-proxy-agent";
import { SocksProxyAgent } from "socks-proxy-agent";
import { isProxyAgent } from "./isProxyAgent";

const proxyURL = "http://localhost:1234";

t.test("recognizes HTTP proxy agents without flagging direct agents", (t) => {
  for (const value of [undefined, false, Object.create(null)]) {
    t.notOk(isProxyAgent(value));
  }

  const agents = [
    new HttpProxyAgent(proxyURL),
    new HttpsProxyAgent(proxyURL),
    new SocksProxyAgent("socks://localhost:1234"),
  ];
  for (const agent of agents) {
    t.ok(isProxyAgent(agent), agent.constructor.name);
    agent.destroy();
  }

  for (const Agent of [HTTPAgent, HTTPSAgent]) {
    for (const proxyEnv of [
      undefined,
      {},
      { HTTP_PROXY: proxyURL, HTTPS_PROXY: proxyURL },
      { http_proxy: proxyURL, https_proxy: proxyURL },
    ]) {
      const agent = new Agent({ proxyEnv });
      t.equal(
        isProxyAgent(agent),
        Boolean(proxyEnv && Object.keys(proxyEnv).length)
      );
      agent.destroy();
    }
  }
  t.end();
});
