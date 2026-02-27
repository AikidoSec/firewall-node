import type { AiMessage } from "../../vulnerabilities/prompt-injection/messages";
import type {
  PromptProtectionApi,
  PromptProtectionApiResponse,
} from "./PromptProtectionAPI";
import type { Token } from "./Token";

export class PromptProtectionAPIForTesting implements PromptProtectionApi {
  constructor(
    private response: PromptProtectionApiResponse = {
      success: true,
      block: false,
    }
  ) {}

  // oxlint-disable-next-line require-await
  async checkForInjection(
    _token: Token,
    _messages: AiMessage[]
  ): Promise<PromptProtectionApiResponse> {
    if (
      _messages.some((msg) =>
        msg.content.includes("!prompt-injection-block-me!")
      )
    ) {
      return {
        success: true,
        block: true,
      };
    }

    return this.response;
  }
}
