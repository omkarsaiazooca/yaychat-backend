import axios from "axios";
import {
  AiProvider,
  AiProviderCompletion,
  AiProviderRequest,
} from "../../../data/aiAssistant";
import { estimateTokens } from "../pricing";

const DEFAULT_MODEL = "gemini-2.0-flash";
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const TIMEOUT_MS = 30_000;

/**
 * Google AI Studio (Gemini) adapter — the default live provider because its
 * free tier needs no billing account. Set `GEMINI_API_KEY` to enable.
 */
export class GeminiProvider implements AiProvider {
  readonly id = "gemini";
  readonly model: string;
  private readonly apiKey: string;

  constructor() {
    this.apiKey = String(process.env.GEMINI_API_KEY || "").trim();
    this.model = String(process.env.GEMINI_MODEL || DEFAULT_MODEL).trim();
  }

  get configured(): boolean {
    return this.apiKey.length > 0;
  }

  async complete(request: AiProviderRequest): Promise<AiProviderCompletion> {
    const response = await axios.post(
      `${BASE_URL}/models/${encodeURIComponent(this.model)}:generateContent`,
      {
        systemInstruction: { parts: [{ text: request.system }] },
        contents: request.messages.map((message) => ({
          // Gemini names the assistant role "model".
          role: message.role === "assistant" ? "model" : "user",
          parts: [{ text: message.text }],
        })),
        generationConfig: { maxOutputTokens: request.maxOutputTokens },
      },
      {
        timeout: TIMEOUT_MS,
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": this.apiKey,
        },
      }
    );

    const candidate = response.data?.candidates?.[0];
    const text = (candidate?.content?.parts || [])
      .map((part: any) => String(part?.text || ""))
      .join("")
      .trim();

    if (!text) {
      throw new Error("Gemini returned an empty completion");
    }

    const usage = response.data?.usageMetadata || {};
    return {
      text,
      tokensIn:
        Number(usage.promptTokenCount) ||
        estimateTokens(request.system + request.messages.map((m) => m.text).join(" ")),
      tokensOut: Number(usage.candidatesTokenCount) || estimateTokens(text),
      provider: this.id,
      model: this.model,
      degraded: false,
    };
  }
}
