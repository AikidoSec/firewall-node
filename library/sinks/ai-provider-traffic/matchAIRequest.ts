export type AIWireFormat =
  | { type: "chat_completions" }
  | { type: "responses" }
  | { type: "anthropic_messages" }
  | { type: "gemini_generate_content"; pathModel: string };

export type AIRequest = {
  format: AIWireFormat;
  provider: string;
};

const geminiGenerateContentPath = /\/models\/([^/:]+):generateContent$/;

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

// The same provider names as the SDK sinks report, so the dashboard doesn't change
export function getAIProvider(hostname: string, format: AIWireFormat): string {
  const host = hostname.toLowerCase();

  switch (host) {
    case "api.openai.com":
      return "openai";
    case "api.anthropic.com":
      return "anthropic";
    case "api.mistral.ai":
      return "mistral";
    case "generativelanguage.googleapis.com":
    case "aiplatform.googleapis.com":
      return "google";
  }

  if (
    isOneLabelBefore(host, ".openai.azure.com") ||
    isOneLabelBefore(host, ".cognitiveservices.azure.com")
  ) {
    return "azure";
  }

  if (isOneLabelBefore(host, "-aiplatform.googleapis.com")) {
    return "google";
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

function isOneLabelBefore(host: string, suffix: string): boolean {
  if (!host.endsWith(suffix)) {
    return false;
  }

  const label = host.slice(0, -suffix.length);

  return label.length > 0 && !label.includes(".");
}
