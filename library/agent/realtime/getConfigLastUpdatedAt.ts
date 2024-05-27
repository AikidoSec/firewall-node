import { fetch } from "../../helpers/fetch";
import { Token } from "../api/Token";
import { getRealtimeURL } from "./getRealtimeURL";

type RealtimeResponse = { configUpdatedAt: number };

export async function getConfigLastUpdatedAt(token: Token): Promise<number> {
  const { body, statusCode } = await fetch({
    url: new URL(`${getRealtimeURL().toString()}config`),
    method: "GET",
    headers: {
      Authorization: token.asString(),
    },
    timeoutInMS: 500,
  });

  if (statusCode !== 200) {
    throw new Error(`Invalid response (${statusCode}): ${body}`);
  }

  const response: RealtimeResponse = JSON.parse(body);

  return response.configUpdatedAt;
}
