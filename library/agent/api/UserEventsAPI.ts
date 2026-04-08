import { fetch } from "../../helpers/fetch";
import { getRealtimeURL } from "../realtime/getRealtimeURL";
import type { Token } from "./Token";

export type UserEvent = {
  name: string;
  userId: string | undefined;
  ipAddress: string | undefined;
};

export async function sendUserEvent(
  token: Token,
  event: UserEvent
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
