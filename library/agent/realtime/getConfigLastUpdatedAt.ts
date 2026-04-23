import { escapeLog } from "../../helpers/escapeLog";
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
    timeoutInMS: 3000,
  });

  if (statusCode === 401) {
    throw new Error(`Token is invalid: ${escapeLog(body)}`);
  }

  if (statusCode !== 200) {
    throw new Error(
      `Expected status code 200, got ${statusCode}: ${escapeLog(body)}`
    );
  }

  const response: RealtimeResponse = JSON.parse(body);

  return response.configUpdatedAt;
}
