import { aiProviderHosts } from "./aiProviderHosts";

export type AIWireFormat =
  | { type: "chat_completions" }
  | { type: "responses" }
  | { type: "anthropic_messages" }
  | { type: "gemini_generate_content"; pathModel: string };

export type AIRequest = {
  format: AIWireFormat;
  provider: string;
};

const geminiGenerateContentPath =
  /\/models\/([^/:]+):(?:generateContent|streamGenerateContent)$/;

export function getAIWireFormat(
  method: string,
  path: string
): AIWireFormat | undefined {
  if (method !== "POST") {
    return undefined;
  }

  const queryStart = path.indexOf("?");
  const pathname = queryStart === -1 ? path : path.slice(0, queryStart);

  if (pathname.endsWith("/chat/completions")) {
    return { type: "chat_completions" };
  }

  if (pathname.endsWith("/responses")) {
    return { type: "responses" };
  }

  if (pathname.endsWith("/v1/messages")) {
    return { type: "anthropic_messages" };
  }

  const gemini = geminiGenerateContentPath.exec(pathname);
  if (gemini) {
    return { type: "gemini_generate_content", pathModel: gemini[1] };
  }

  return undefined;
}

export function getAIProvider(hostname: string, format: AIWireFormat): string {
  const host = hostname.toLowerCase();
  const known = aiProviderHosts.find(([pattern]) => hostMatches(pattern, host));
  if (known) {
    return known[1];
  }

  switch (format.type) {
    case "chat_completions":
    case "responses":
      return "openai_compatible";
    case "anthropic_messages":
      return "anthropic_compatible";
    case "gemini_generate_content":
      return "gemini_compatible";
  }
}

// A leading `*` matches the start of the first DNS label, or all of it
function hostMatches(pattern: string, host: string): boolean {
  if (!pattern.startsWith("*")) {
    return pattern === host;
  }

  const suffix = pattern.slice(1);
  if (!host.endsWith(suffix)) {
    return false;
  }

  const label = host.slice(0, -suffix.length);

  return label.length > 0 && !label.includes(".");
}
