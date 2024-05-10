import { fetch } from "../../helpers/fetch";
import { Token } from "../api/Token";
import { getRealtimeURL } from "./getRealtimeURL";

export async function getConfig(token: Token) {
  const { body, statusCode } = await fetch({
    url: new URL(`${getRealtimeURL().toString()}api/runtime/config`),
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
