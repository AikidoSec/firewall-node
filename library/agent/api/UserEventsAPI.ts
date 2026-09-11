import { fetch } from "../../helpers/fetch";
import { getRealtimeURL } from "../realtime/getRealtimeURL";
import type { Token } from "./Token";
import type { CustomEvent } from "./Event";

export async function sendUserEvent(
  token: Token,
  event: CustomEvent
): Promise<void> {
  await fetch({
    url: new URL(`${getRealtimeURL().toString()}api/runtime/events`),
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token.asString(),
    },
    body: JSON.stringify(event),
    timeoutInMS: 5000,
  });
}
