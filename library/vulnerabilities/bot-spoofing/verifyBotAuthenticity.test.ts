import * as t from "tap";
import { verifyBotAuthenticity } from "./verifyBotAuthenticity";
import { IPMatcher } from "../../helpers/ip-matcher/IPMatcher";

t.test("it works with a matching IP", async (t) => {
  const matchingBot = {
    key: "bot",
    uaPattern: /bot/i,
    ips: new IPMatcher(["123.123.0.0/16"]),
    hostnames: [],
  };

  t.same(await verifyBotAuthenticity("", matchingBot), false);
  t.same(await verifyBotAuthenticity("1.2.3.4", matchingBot), false);
  t.same(await verifyBotAuthenticity("123.123.1.2", matchingBot), true);
  t.same(await verifyBotAuthenticity("123.123.123.123", matchingBot), true);
});

t.test("it works with hostnames (googlebot)", async (t) => {
  const matchingBot = {
    key: "google_test",
    uaPattern: /Googlebot/i,
    ips: new IPMatcher(),
    hostnames: ["google.com", "googlebot.com"],
  };

  t.same(await verifyBotAuthenticity("1.1.1.1", matchingBot), false);
  t.same(await verifyBotAuthenticity("66.249.90.77", matchingBot), true);
});

t.test("it works with hostnames (bingbot)", async (t) => {
  const matchingBot = {
    key: "bing_test",
    uaPattern: /207.46.13.14/i,
    ips: new IPMatcher(),
    hostnames: ["search.msn.com", "bing.com"],
  };

  t.same(await verifyBotAuthenticity("1.1.1.1", matchingBot), false);
  t.same(
    await verifyBotAuthenticity("2606:4700:4700::1111", matchingBot),
    false
  );
  t.same(
    await verifyBotAuthenticity("192.0.2.1", matchingBot), // TEST-NET-1
    false
  );
  t.same(await verifyBotAuthenticity("1", matchingBot), true); // Fallback to true on error
  t.same(await verifyBotAuthenticity("207.46.13.14", matchingBot), true);
});
