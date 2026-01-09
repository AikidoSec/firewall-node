import { fetch } from "../../helpers/fetch";
import { getPromptInjectionServiceURL } from "../../helpers/getPromptInjectionServiceURL";
import type { AiMessage } from "../../vulnerabilities/prompt-injection/messages";
import type {
  PromptProtectionApi,
  PromptProtectionApiResponse,
} from "./PromptProtectionAPI";
import type { Token } from "./Token";

export class PromptProtectionAPINodeHTTP implements PromptProtectionApi {
  constructor(private baseUrl = getPromptInjectionServiceURL()) {}

  async checkForInjection(
    token: Token,
    messages: AiMessage[]
  ): Promise<PromptProtectionApiResponse> {
    const { body, statusCode } = await fetch({
      url: new URL("/api/v1/analyze", this.baseUrl.toString()),
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: token.asString(),
      },
      body: JSON.stringify({ input: messages }),
      timeoutInMS: 15 * 1000,
    });

    if (statusCode !== 200) {
      if (statusCode === 401) {
        throw new Error(
          `Unable to access the Prompt Protection service, please check your token.`
        );
      }
      throw new Error(`Failed to fetch prompt analysis: ${statusCode}`);
    }

    return this.toAPIResponse(body);
  }

  private toAPIResponse(data: string): PromptProtectionApiResponse {
    const result = JSON.parse(data);

    return {
      success: result.success === true,
      block: result.block === true,
    };
  }
}
