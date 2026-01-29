import type { AiMessage } from "../../vulnerabilities/prompt-injection/messages";
import type { Token } from "./Token";

export type PromptProtectionApiResponse = {
  success: boolean;
  block: boolean;
};

export interface PromptProtectionApi {
  checkForInjection(
    token: Token,
    messages: AiMessage[]
  ): Promise<PromptProtectionApiResponse>;
}
