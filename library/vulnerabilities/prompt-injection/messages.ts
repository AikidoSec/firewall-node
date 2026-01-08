import { isPlainObject } from "../../helpers/isPlainObject";

export type AiMessage = {
  content: string;
  role: "user" | "system";
};

export function isAiMessage(message: unknown): message is AiMessage {
  return (
    isPlainObject(message) &&
    "content" in message &&
    typeof message.content === "string" &&
    "role" in message &&
    typeof message.role === "string"
  );
}

export function isAiMessagesArray(messages: unknown): messages is AiMessage[] {
  return (
    Array.isArray(messages) && messages.every((message) => isAiMessage(message))
  );
}
