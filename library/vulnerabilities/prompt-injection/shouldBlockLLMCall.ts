import { fetch } from "../../helpers/fetch";
import { isPlainObject } from "../../helpers/isPlainObject";
import { tryParseURL } from "../../helpers/tryParseURL";

function getPromptInjectionURL() {
  if (!process.env.PROMPT_INJECTION_ENDPOINT) {
    return undefined;
  }

  return tryParseURL(process.env.PROMPT_INJECTION_ENDPOINT);
}

function getPromptInjectionAPIKey() {
  return process.env.PROMPT_INJECTION_API_KEY;
}

type Decision = {
  block: boolean;
};

function isDecision(json: unknown): json is { block: boolean } {
  return isPlainObject(json) && typeof json.block === "boolean";
}

export async function shouldBlockLLMCall(input: string): Promise<Decision> {
  const url = getPromptInjectionURL();
  if (!url) {
    return { block: false };
  }

  const secret = getPromptInjectionAPIKey();
  if (!secret) {
    return { block: false };
  }

  const { body, statusCode } = await fetch({
    url: url,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": secret,
    },
    body: JSON.stringify({ prompt: input }),
  });

  if (statusCode !== 200) {
    return { block: false };
  }

  const decision: unknown = JSON.parse(body);
  if (!isDecision(decision)) {
    return { block: false };
  }

  return {
    block: decision.block,
  };
}
