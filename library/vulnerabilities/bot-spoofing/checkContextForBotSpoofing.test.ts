import * as t from "tap";
import { checkContextForBotSpoofing } from "./checkContextForBotSpoofing";
import { startTestAgent } from "../../helpers/startTestAgent";
import { Context } from "../../agent/Context";

const getTestContext = (ip: string, ua: string): Context => {
  return {
    remoteAddress: ip,
    method: "GET",
    url: "http://localhost:4000/",
    query: {},
    headers: {
      "user-agent": ua,
    },
    body: undefined,
    cookies: {},
    routeParams: {},
    source: "hono",
    route: "/",
  };
};

t.test("it works", async (t) => {
  const agent = startTestAgent({
    block: true,
    rewrite: {},
    wrappers: [],
  });

  t.same(
    await checkContextForBotSpoofing(
      getTestContext("1.1.1.1", "Googlebot"), // No bot spoofing data set
      agent
    ),
    {
      isSpoofing: false,
    }
  );

  agent.getConfig().updateBotSpoofingData([]);
  t.same(
    await checkContextForBotSpoofing(
      getTestContext("1.1.1.1", "Googlebot"), // No bot spoofing data set
      agent
    ),
    {
      isSpoofing: false,
    }
  );

  agent.getConfig().updateBotSpoofingData([
    {
      key: "google_test",
      uaPattern: "NotGooglebot",
      ips: [],
      hostnames: ["google.com", "googlebot.com"],
    },
  ]);

  t.same(
    await checkContextForBotSpoofing(
      getTestContext("1.1.1.1", "Googlebot"), // Regex not matching
      agent
    ),
    {
      isSpoofing: false,
    }
  );

  agent.getConfig().updateBotSpoofingData([
    {
      key: "google_test",
      uaPattern: "Googlebot",
      ips: [],
      hostnames: [],
    },
  ]);

  t.same(
    await checkContextForBotSpoofing(
      getTestContext("1.1.1.1", "Googlebot"), // Not blocked because ip and hostname are empty
      agent
    ),
    {
      isSpoofing: false,
    }
  );

  agent.getConfig().updateBotSpoofingData([
    {
      key: "google_test",
      uaPattern: "Googlebot",
      ips: ["1.2.3.4"],
      hostnames: [],
    },
  ]);

  t.same(
    await checkContextForBotSpoofing(
      getTestContext("1.1.1.1", "Googlebot"), // Blocked because ip is not matching
      agent
    ),
    {
      isSpoofing: true,
      key: "google_test",
    }
  );

  agent.getConfig().updateBotSpoofingData([
    {
      key: "google_test",
      uaPattern: "Googlebot",
      ips: [],
      hostnames: ["google.com", "googlebot.com"],
    },
  ]);

  t.same(
    await checkContextForBotSpoofing(
      getTestContext("1.1.1.1", "Googlebot"), // Blocked because Hostname is not matching
      agent
    ),
    {
      isSpoofing: true,
      key: "google_test",
    }
  );

  agent.getConfig().updateBotSpoofingData([
    {
      key: "google_test",
      uaPattern: "Googlebot",
      ips: ["1.2.3.4"],
      hostnames: [],
    },
  ]);

  t.same(
    await checkContextForBotSpoofing(
      getTestContext("1.2.3.4", "Googlebot"), // Allowed because ip is matching
      agent
    ),
    {
      isSpoofing: false,
      key: "google_test",
    }
  );

  agent.getConfig().updateBotSpoofingData([
    {
      key: "google_test",
      uaPattern: "Googlebot",
      ips: ["1.2.3.4"],
      hostnames: ["google.com", "googlebot.com"],
    },
    {
      key: "bing_test",
      uaPattern: "Bingbot",
      ips: [""],
      hostnames: ["search.msn.com", "bing.com"],
    },
  ]);

  t.same(
    await checkContextForBotSpoofing(
      getTestContext("66.249.90.77", "Googlebot"), // Allowed because Hostname is matching
      agent
    ),
    {
      isSpoofing: false,
      key: "google_test",
    }
  );
  t.same(
    await checkContextForBotSpoofing(
      getTestContext("1.2.3.4", "Googlebot"), // Allowed because ip is matching
      agent
    ),
    {
      isSpoofing: false,
      key: "google_test",
    }
  );
  t.same(
    await checkContextForBotSpoofing(
      getTestContext("1.1.1.1", "Googlebot"), // Blocked because ip and hostname are not matching
      agent
    ),
    {
      isSpoofing: true,
      key: "google_test",
    }
  );
  t.same(
    await checkContextForBotSpoofing(
      getTestContext("1.1.1.1", "Test"), // Allowed because user agent is not matching
      agent
    ),
    {
      isSpoofing: false,
    }
  );
  t.same(
    await checkContextForBotSpoofing(
      getTestContext("", "Googlebot"), // Allowed because ip is empty
      agent
    ),
    {
      isSpoofing: false,
    }
  );
  t.same(
    await checkContextForBotSpoofing(
      getTestContext("1.1.1.1", ""), // Empty user agent
      agent
    ),
    {
      isSpoofing: false,
    }
  );
  t.same(
    await checkContextForBotSpoofing(
      getTestContext("127.0.0.1", "Googlebot"), // Allowed because ip is private
      agent
    ),
    {
      isSpoofing: false,
    }
  );
  t.same(
    await checkContextForBotSpoofing(
      getTestContext("::1", "Googlebot"), // Allowed because ip is private
      agent
    ),
    {
      isSpoofing: false,
    }
  );
  t.same(
    await checkContextForBotSpoofing(
      getTestContext("1.1.1.1", "Bingbot"), // Is bot spoofing
      agent
    ),
    {
      isSpoofing: true,
      key: "bing_test",
    }
  );
  t.same(
    await checkContextForBotSpoofing(
      getTestContext("207.46.13.14", "Bingbot"), // Real bing ip
      agent
    ),
    {
      isSpoofing: false,
      key: "bing_test",
    }
  );

  agent.getConfig().updateBotSpoofingData([
    {
      key: "google_test",
      uaPattern: "Googlebot",
      ips: [],
      hostnames: [],
    },
  ]);

  // No ips or hostnames to verify, so it should not be considered bot spoofing
  t.same(
    await checkContextForBotSpoofing(
      getTestContext("1.1.1.1", "Googlebot"),
      agent
    ),
    {
      isSpoofing: false,
    }
  );
});
