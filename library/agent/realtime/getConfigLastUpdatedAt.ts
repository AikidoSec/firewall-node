import { fetch } from "../../helpers/fetch";
import { Token } from "../api/Token";

type RealtimeResponse = { configUpdatedAt: number };

export async function getConfigLastUpdatedAt(
  token: Token,
  realtimeURL: URL
): Promise<number> {
  const { body, statusCode } = await fetch({
    url: new URL(`${realtimeURL.toString()}config`),
    method: "GET",
    headers: {
      Authorization: token.asString(),
    },
    timeoutInMS: 3000,
  });

  if (statusCode === 401) {
    throw new Error("Token is invalid");
  }

  if (statusCode !== 200) {
    throw new Error(`Expected status code 200, got ${statusCode}`);
  }

  const response: RealtimeResponse = JSON.parse(body);

  return response.configUpdatedAt;
}
