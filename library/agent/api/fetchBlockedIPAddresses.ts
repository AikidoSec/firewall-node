import { fetch } from "../../helpers/fetch";
import { getAPIURL } from "../getAPIURL";
import { Token } from "./Token";

export type Blocklist = {
  source: string;
  description: string;
  ips: string[];
};

export async function fetchBlockedIPAddresses(
  token: Token
): Promise<Blocklist[]> {
  const baseUrl = getAPIURL();
  const { body, statusCode } = await fetch({
    url: new URL(`${baseUrl.toString()}api/runtime/firewall/lists`),
    method: "GET",
    headers: {
      // We need to set the Accept-Encoding header to "gzip" to receive the response in gzip format
      "Accept-Encoding": "gzip",
      Authorization: token.asString(),
    },
    timeoutInMS: 10000,
  });

  if (statusCode !== 200) {
    throw new Error(`Failed to fetch blocked IP addresses: ${statusCode}`);
  }

  const result: {
    blockedIPAddresses: Blocklist[];
  } = JSON.parse(body);

  return result && result.blockedIPAddresses ? result.blockedIPAddresses : [];
}
