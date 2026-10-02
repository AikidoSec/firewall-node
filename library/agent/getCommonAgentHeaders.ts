import { getAgentSessionId } from "../helpers/getAgentSessionId";
import { getAgentVersion } from "../helpers/getAgentVersion";
import { getInstanceHostname } from "../helpers/getInstanceHostname";
import { ip } from "../helpers/ipAddress";

export function getCommonAgentHeaders(): Record<string, string> {
  return {
    "X-Agent-Platform": "node",
    "X-Agent-Version": getAgentVersion(),
    "X-Agent-Hostname": getInstanceHostname() || "unknown",
    "X-Agent-IP-Address": ip() || "unknown",
    "X-Agent-Session-Id": getAgentSessionId(),
  };
}
