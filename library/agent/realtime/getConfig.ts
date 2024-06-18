import { fetch } from "../../helpers/fetch";
import { Token } from "../api/Token";
import { Config } from "../Config";
import { getAPIURL } from "../getAPIURL";

export async function getConfig(token: Token): Promise<Config> {
  const { body, statusCode } = await fetch({
    url: new URL(`${getAPIURL().toString()}api/runtime/config`),
    method: "GET",
    headers: {
      Authorization: token.asString(),
    },
    timeoutInMS: 3000,
  });

  if (statusCode !== 200) {
    throw new Error(`Invalid response (${statusCode}): ${body}`);
  }

  return JSON.parse(body);
}
