import {
  AiProvider,
  AiProviderCompletion,
  AiProviderRequest,
} from "../../../data/aiAssistant";
import { estimateTokens } from "../pricing";

/**
 * Deterministic, dependency-free provider.
 *
 * Two jobs: it is the default when no provider credentials are configured, and
 * it is the degraded path every live provider falls back to during an outage —
 * so an AI request never hard-fails the caller.
 */
export class StubProvider implements AiProvider {
  readonly id = "stub";
  readonly model = "yaysapp-offline-v1";
  readonly configured = true;

  async complete(request: AiProviderRequest): Promise<AiProviderCompletion> {
    const lastUser = [...request.messages]
      .reverse()
      .find((m) => m.role === "user");
    const prompt = (lastUser?.text || "").trim();
    const text = this.answer(prompt);
    return {
      text,
      tokensIn: estimateTokens(
        request.system + request.messages.map((m) => m.text).join(" ")
      ),
      tokensOut: estimateTokens(text),
      provider: this.id,
      model: this.model,
      degraded: true,
    };
  }

  private answer(prompt: string): string {
    const excerpt = prompt.length > 80 ? `${prompt.slice(0, 80)}…` : prompt;
    if (!excerpt) {
      return "The AI service is not reachable right now. Please try again in a moment.";
    }
    return [
      "The AI service is temporarily unavailable, so this is an offline reply.",
      "",
      `Your request: “${excerpt}”`,
      "",
      "Nothing was sent to an AI provider and no credits were used. Try again shortly.",
    ].join("\n");
  }
}
