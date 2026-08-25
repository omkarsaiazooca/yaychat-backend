import { randomUUID } from "crypto";
import {
  AiContentScope,
  AiConsent,
  AiConversation,
  AiProviderCompletion,
  AiProviderMessage,
  AiUsageDaily,
} from "../data/aiAssistant";
import { AiAssistantConsentService } from "./aiAssistantConsent.service";
import { AiAssistantConversationService } from "./aiAssistantConversation.service";
import { AiAssistantUsageService } from "./aiAssistantUsage.service";
import { systemPromptFor, toolById } from "./ai/catalog";
import { costOf } from "./ai/pricing";
import { resolveProvider, StubProvider } from "./ai/providers";
import { applyDisclaimers, screenPrompt } from "./ai/safety";

/** Per-plan daily quotas. Enforced server-side before any provider call. */
export interface AiPlan {
  id: string;
  label: string;
  dailyRequests: number;
  /** Hard stop on spend per user per day; 0 disables the cost gate. */
  dailyCostUsd: number;
  maxPromptChars: number;
  maxOutputTokens: number;
  /** Prior turns replayed to the model when personalization is on. */
  historyTurns: number;
}

export const AI_PLANS: Record<string, AiPlan> = {
  free: {
    id: "free",
    label: "Free plan",
    dailyRequests: Number(process.env.AI_FREE_DAILY_REQUESTS || 40),
    dailyCostUsd: Number(process.env.AI_FREE_DAILY_COST_USD || 0.5),
    maxPromptChars: 8000,
    maxOutputTokens: 1024,
    historyTurns: 8,
  },
  plus: {
    id: "plus",
    label: "Plus plan",
    dailyRequests: Number(process.env.AI_PLUS_DAILY_REQUESTS || 400),
    dailyCostUsd: Number(process.env.AI_PLUS_DAILY_COST_USD || 5),
    maxPromptChars: 24000,
    maxOutputTokens: 2048,
    historyTurns: 16,
  },
};

export const planFor = (planId?: string): AiPlan =>
  AI_PLANS[String(planId || "free")] || AI_PLANS.free;

/** Thrown for every condition the client is expected to render specifically. */
export class AiServiceError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code:
      | "consent_required"
      | "rate_limited"
      | "blocked"
      | "validation"
      | "not_found"
  ) {
    super(message);
  }
}

export interface AiAnswer {
  text: string;
  degraded: boolean;
  provider: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  usage: AiUsageDaily;
}

const consentService = new AiAssistantConsentService();
const conversationService = new AiAssistantConversationService();
const usageService = new AiAssistantUsageService();

const MAX_STORED_MESSAGES = 60;

/**
 * Mongo throws a CastError on a malformed `_id`, which would surface as a 500.
 * Anything that is not a 24-character hex id is simply "not found".
 */
const isObjectId = (value: string): boolean => /^[0-9a-fA-F]{24}$/.test(value);

export class AiAssistantService {
  /** Tools, prompts, quotas, and live provider status for the AI hub. */
  status(planId?: string) {
    const provider = resolveProvider();
    const plan = planFor(planId);
    return {
      plan,
      provider: {
        id: provider.id,
        model: provider.model,
        /** False means every answer will come from the offline stub. */
        live: provider.id !== "stub",
      },
    };
  }

  async consent(userLower: string): Promise<AiConsent> {
    return consentService.forUser(userLower);
  }

  async updateConsent(
    userLower: string,
    patch: Partial<AiConsent>
  ): Promise<AiConsent> {
    return consentService.update(userLower, {
      ...(typeof patch.shareChatContent === "boolean"
        ? { shareChatContent: patch.shareChatContent }
        : {}),
      ...(typeof patch.shareCommunityContent === "boolean"
        ? { shareCommunityContent: patch.shareCommunityContent }
        : {}),
      ...(typeof patch.saveHistory === "boolean"
        ? { saveHistory: patch.saveHistory }
        : {}),
      ...(typeof patch.personalization === "boolean"
        ? { personalization: patch.personalization }
        : {}),
    });
  }

  async usage(userLower: string, planId?: string): Promise<AiUsageDaily> {
    return usageService.today(userLower, planFor(planId).id);
  }

  /**
   * Reject the request before any provider call if the user is out of quota.
   * Both a request count and a spend ceiling are checked.
   */
  private async assertWithinQuota(userLower: string, plan: AiPlan) {
    const usage = await usageService.today(userLower, plan.id);
    if (usage.requests >= plan.dailyRequests) {
      throw new AiServiceError(
        `You have used all ${plan.dailyRequests} AI requests for today. Your quota resets at midnight UTC.`,
        429,
        "rate_limited"
      );
    }
    if (plan.dailyCostUsd > 0 && usage.costUsd >= plan.dailyCostUsd) {
      throw new AiServiceError(
        "You have reached today's AI usage limit. Your quota resets at midnight UTC.",
        429,
        "rate_limited"
      );
    }
    return usage;
  }

  /**
   * Private chat and community content may only reach a model when the user
   * has explicitly opted in for that scope.
   */
  private assertConsent(consent: AiConsent, scope: AiContentScope) {
    if (scope === "chat" && !consent.shareChatContent) {
      throw new AiServiceError(
        "Turn on 'Share chat content with AI' before using AI inside a conversation.",
        403,
        "consent_required"
      );
    }
    if (scope === "community" && !consent.shareCommunityContent) {
      throw new AiServiceError(
        "Turn on 'Share community content with AI' before using AI inside a community.",
        403,
        "consent_required"
      );
    }
  }

  /**
   * Run one completion end to end: consent, quota, safety screen, provider
   * call with a degraded fallback, disclaimers, then cost accounting.
   */
  private async complete(options: {
    userLower: string;
    planId?: string;
    system: string;
    history: AiProviderMessage[];
    prompt: string;
    scope: AiContentScope;
  }): Promise<AiAnswer> {
    const plan = planFor(options.planId);
    const prompt = String(options.prompt || "").trim();

    if (!prompt) {
      throw new AiServiceError("A prompt is required.", 400, "validation");
    }
    if (prompt.length > plan.maxPromptChars) {
      throw new AiServiceError(
        `That is too long — the ${plan.label} accepts up to ${plan.maxPromptChars} characters per request.`,
        400,
        "validation"
      );
    }

    const consent = await this.consent(options.userLower);
    this.assertConsent(consent, options.scope);
    await this.assertWithinQuota(options.userLower, plan);

    const verdict = screenPrompt(prompt);
    if (verdict.blocked) {
      throw new AiServiceError(verdict.reason || "Request blocked.", 400, "blocked");
    }

    const history = consent.personalization
      ? options.history.slice(-plan.historyTurns)
      : [];

    const provider = resolveProvider();
    const request = {
      system: options.system,
      messages: [...history, { role: "user" as const, text: prompt }],
      maxOutputTokens: plan.maxOutputTokens,
    };

    let completion: AiProviderCompletion;
    try {
      completion = await provider.complete(request);
    } catch (error: any) {
      // Provider outage must not fail the request — degrade, and log enough to
      // tell an outage apart from a bad request in the provider dashboard.
      console.error(
        `[ai] provider ${provider.id} failed: ${error?.response?.status || ""} ${
          error?.message || error
        }`
      );
      completion = await new StubProvider().complete(request);
    }

    const text = applyDisclaimers(completion.text, verdict.categories);
    const costUsd = costOf(
      completion.provider,
      completion.model,
      completion.tokensIn,
      completion.tokensOut
    );

    const usage = await usageService.record(
      options.userLower,
      plan.id,
      completion.tokensIn,
      completion.tokensOut,
      costUsd
    );

    return {
      text,
      degraded: completion.degraded,
      provider: completion.provider,
      model: completion.model,
      tokensIn: completion.tokensIn,
      tokensOut: completion.tokensOut,
      costUsd,
      usage,
    };
  }

  // -------------------------------------------------------------------------
  // Assistant conversations
  // -------------------------------------------------------------------------

  async history(userLower: string): Promise<AiConversation[]> {
    return conversationService.listForUser(userLower);
  }

  async conversation(
    userLower: string,
    conversationId: string
  ): Promise<AiConversation> {
    if (!isObjectId(conversationId)) {
      throw new AiServiceError("Conversation not found.", 404, "not_found");
    }
    const found = await conversationService.findOne({
      _id: conversationId,
      userLower,
      deletedAt: null,
    });
    if (!found) {
      throw new AiServiceError("Conversation not found.", 404, "not_found");
    }
    return found;
  }

  async startConversation(
    userEmail: string,
    tool: string,
    firstPrompt?: string
  ): Promise<AiConversation> {
    const userLower = userEmail.toLowerCase();
    const resolved = toolById(tool);
    return conversationService.create({
      userEmail,
      userLower,
      tool: resolved.id,
      title: firstPrompt?.trim().slice(0, 60) || `New ${resolved.title} session`,
      saved: false,
      messages: [],
      tokensIn: 0,
      tokensOut: 0,
      costUsd: 0,
    } as any);
  }

  /** Send a turn in an assistant thread and persist both sides of it. */
  async sendMessage(options: {
    userEmail: string;
    conversationId: string;
    prompt: string;
    planId?: string;
  }): Promise<{ conversation: AiConversation; answer: AiAnswer }> {
    const userLower = options.userEmail.toLowerCase();
    const conversation = await this.conversation(userLower, options.conversationId);
    const consent = await this.consent(userLower);

    const answer = await this.complete({
      userLower,
      planId: options.planId,
      system: systemPromptFor(conversation.tool),
      history: conversation.messages.map((message) => ({
        role: message.role,
        text: message.text,
      })),
      prompt: options.prompt,
      scope: "assistant",
    });

    const now = new Date();
    const turn = [
      {
        messageId: randomUUID(),
        role: "user" as const,
        // With history off, prompts are not retained beyond this response.
        text: consent.saveHistory ? options.prompt.trim() : "[not stored]",
        createdAt: now,
      },
      {
        messageId: randomUUID(),
        role: "assistant" as const,
        text: consent.saveHistory ? answer.text : "[not stored]",
        degraded: answer.degraded,
        createdAt: now,
      },
    ];

    const messages = [...conversation.messages, ...turn].slice(-MAX_STORED_MESSAGES);
    const updated = await conversationService.findOneUpdate(
      { _id: conversation._id },
      {
        $set: {
          messages,
          title:
            conversation.messages.length === 0
              ? options.prompt.trim().slice(0, 60)
              : conversation.title,
          provider: answer.provider,
          model: answer.model,
        },
        $inc: {
          tokensIn: answer.tokensIn,
          tokensOut: answer.tokensOut,
          costUsd: answer.costUsd,
        },
      },
      { new: true }
    );

    return { conversation: updated, answer };
  }

  async setSaved(
    userLower: string,
    conversationId: string,
    saved: boolean
  ): Promise<AiConversation> {
    await this.conversation(userLower, conversationId);
    return conversationService.findOneUpdate(
      { _id: conversationId, userLower },
      { $set: { saved } },
      { new: true }
    );
  }

  async deleteConversation(userLower: string, conversationId: string) {
    await this.conversation(userLower, conversationId);
    await conversationService.findOneUpdate(
      { _id: conversationId, userLower },
      // Soft delete so an abuse report still has its source thread.
      { $set: { deletedAt: new Date(), messages: [] } },
      { new: true }
    );
  }

  // -------------------------------------------------------------------------
  // One-shot assists used from inside a chat or community
  // -------------------------------------------------------------------------

  /**
   * A single completion over content the user explicitly shared, with no
   * thread persisted. `scope` selects which consent switch gates the call.
   */
  async assist(options: {
    userEmail: string;
    system: string;
    prompt: string;
    scope: AiContentScope;
    planId?: string;
  }): Promise<AiAnswer> {
    return this.complete({
      userLower: options.userEmail.toLowerCase(),
      planId: options.planId,
      system: options.system,
      history: [],
      prompt: options.prompt,
      scope: options.scope,
    });
  }

  /** Support-desk turn: no consent gate (the user typed the content). */
  async supportReply(options: {
    userEmail: string;
    history: AiProviderMessage[];
    prompt: string;
    planId?: string;
  }): Promise<AiAnswer> {
    return this.complete({
      userLower: options.userEmail.toLowerCase(),
      planId: options.planId,
      system: systemPromptFor("support"),
      history: options.history,
      prompt: options.prompt,
      scope: "assistant",
    });
  }
}
