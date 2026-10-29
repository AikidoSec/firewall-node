import * as t from "tap";
import { getAIProvider, getAIWireFormat } from "./matchAIRequest";

t.test(
  "recognizes provider protocols and custom base URLs without inspecting query values",
  async (t) => {
    for (const [method, path, expected] of [
      ["POST", "/v1/chat/completions?key=secret", "chat_completions"],
      [
        "POST",
        "/openai/deployments/model/responses?api-version=2025-01-01",
        "responses",
      ],
      ["POST", "/custom/v1/messages", "anthropic_messages"],
      [
        "POST",
        "/v1beta/models/gemini:streamGenerateContent?alt=sse",
        "gemini_generate_content",
      ],
      ["GET", "/v1/chat/completions", undefined],
      ["POST", "/other?path=/chat/completions", undefined],
    ] as const)
      t.equal(getAIWireFormat(method, path)?.type, expected);
    for (const [host, format, expected] of [
      ["api.openai.com", "chat_completions", "openai"],
      ["api.anthropic.com", "anthropic_messages", "anthropic"],
      ["custom.openai.azure.com", "responses", "azure"],
      ["attacker.api.openai.com", "responses", "openai_compatible"],
      ["api.openai.com.example.org", "responses", "openai_compatible"],
      ["localhost", "anthropic_messages", "anthropic_compatible"],
    ] as const)
      t.equal(getAIProvider(host, { type: format }), expected);
  }
);
