import * as t from "tap";
import { getAIProvider, getAIWireFormat } from "./matchAIRequest";

t.test("it matches POST requests by path suffix", async (t) => {
  t.same(getAIWireFormat("POST", "/v1/chat/completions"), {
    type: "chat_completions",
  });
  t.same(
    getAIWireFormat(
      "POST",
      "/openai/deployments/gpt-5/chat/completions?api-version=2024-10-21"
    ),
    { type: "chat_completions" }
  );
  t.same(getAIWireFormat("POST", "/v1/responses"), { type: "responses" });
  t.same(getAIWireFormat("POST", "/anthropic/v1/messages"), {
    type: "anthropic_messages",
  });
  t.same(
    getAIWireFormat(
      "POST",
      "/v1beta/models/gemini-2.5-flash:generateContent?key=secret"
    ),
    { type: "gemini_generate_content", pathModel: "gemini-2.5-flash" }
  );

  t.equal(getAIWireFormat("GET", "/v1/responses"), undefined);
  t.equal(getAIWireFormat("POST", "/v1/messages/count_tokens"), undefined);
  t.equal(getAIWireFormat("POST", "/v1/embeddings"), undefined);
  t.equal(
    getAIWireFormat(
      "POST",
      "/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse"
    ),
    undefined
  );
});

t.test("it names the provider after the hostname", async (t) => {
  const chat = { type: "chat_completions" } as const;
  const messages = { type: "anthropic_messages" } as const;
  const gemini = { type: "gemini_generate_content", pathModel: "m" } as const;

  t.equal(getAIProvider("api.openai.com", chat), "openai");
  t.equal(getAIProvider("API.OpenAI.com", chat), "openai");
  t.equal(getAIProvider("my-resource.openai.azure.com", chat), "azure");
  t.equal(
    getAIProvider("my-resource.cognitiveservices.azure.com", chat),
    "azure"
  );
  t.equal(getAIProvider("api.mistral.ai", chat), "mistral");
  t.equal(getAIProvider("api.anthropic.com", messages), "anthropic");
  t.equal(getAIProvider("generativelanguage.googleapis.com", gemini), "google");
  t.equal(
    getAIProvider("us-central1-aiplatform.googleapis.com", gemini),
    "google"
  );

  t.equal(getAIProvider("api.openai.com.evil.com", chat), "openai_compatible");
  t.equal(getAIProvider("a.b.openai.azure.com", chat), "openai_compatible");
  t.equal(getAIProvider("openai.azure.com", chat), "openai_compatible");
  t.equal(getAIProvider("litellm.internal", messages), "anthropic_compatible");
  t.equal(getAIProvider("localhost", gemini), "gemini_compatible");
});
