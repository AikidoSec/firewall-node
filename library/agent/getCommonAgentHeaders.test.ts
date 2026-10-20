import * as t from "tap";
import { getAgentSessionId } from "../helpers/getAgentSessionId";
import { getAgentVersion } from "../helpers/getAgentVersion";
import { getInstanceHostname } from "../helpers/getInstanceHostname";
import { ip } from "../helpers/ipAddress";
import { getCommonAgentHeaders } from "./getCommonAgentHeaders";

t.test("it returns the common agent headers", async (t) => {
  t.same(getCommonAgentHeaders(), {
    "X-Agent-Platform": "node",
    "X-Agent-Library": "firewall-node",
    "X-Agent-Version": getAgentVersion(),
    "X-Agent-Hostname": getInstanceHostname() || "unknown",
    "X-Agent-IP-Address": ip() || "unknown",
    "X-Agent-Session-Id": getAgentSessionId(),
  });
});

t.test("it uses AIKIDO_INSTANCE_NAME as the hostname header", async (t) => {
  process.env.AIKIDO_INSTANCE_NAME = "my-instance";
  t.equal(getCommonAgentHeaders()["X-Agent-Hostname"], "my-instance");
  delete process.env.AIKIDO_INSTANCE_NAME;
});

t.test("it returns the same session id on every call", async (t) => {
  t.equal(
    getCommonAgentHeaders()["X-Agent-Session-Id"],
    getCommonAgentHeaders()["X-Agent-Session-Id"]
  );
});
