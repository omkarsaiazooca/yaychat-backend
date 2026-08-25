import { IDocumentModel, IModel } from "./base";

/** Roles used in an assistant thread. */
export type AiRole = "user" | "assistant";

/** Where the content the model sees came from. Drives the consent gate. */
export type AiContentScope =
  | "assistant"
  | "chat"
  | "community";

export interface AiMessage {
  messageId: string;
  role: AiRole;
  text: string;
  /** Set on assistant turns that were produced by the degraded/offline path. */
  degraded?: boolean;
  createdAt: Date;
}

export interface AiConversation extends IModel, IDocumentModel<AiConversation> {
  userEmail: string;
  userLower: string;
  tool: string;
  title: string;
  saved: boolean;
  messages: AiMessage[];
  /** Rolling per-conversation cost so a single thread's spend is observable. */
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  provider?: string | null;
  model?: string | null;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AiUsageDaily extends IModel, IDocumentModel<AiUsageDaily> {
  userLower: string;
  /** UTC calendar day, `YYYY-MM-DD`. Quotas reset on this boundary. */
  day: string;
  plan: string;
  requests: number;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AiConsent extends IModel, IDocumentModel<AiConsent> {
  userLower: string;
  /** Explicit opt-in before any private chat content is sent to a model. */
  shareChatContent: boolean;
  /** Explicit opt-in before community content is sent to a model. */
  shareCommunityContent: boolean;
  /** When false, prompts and answers are not persisted beyond the response. */
  saveHistory: boolean;
  /** When false, prior turns are not replayed to the model. */
  personalization: boolean;
  acceptedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type AiReportStatus = "open" | "reviewing" | "actioned" | "dismissed";

export interface AiReport extends IModel, IDocumentModel<AiReport> {
  userLower: string;
  conversationId?: string | null;
  messageId?: string | null;
  reason: string;
  /** Trimmed copy of the offending answer so review does not need the thread. */
  excerpt: string;
  status: AiReportStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type SupportTicketStatus =
  | "ai_handling"
  | "awaiting_user"
  | "escalated"
  | "resolved";

export interface SupportTicketMessage {
  messageId: string;
  author: "user" | "ai" | "agent";
  text: string;
  createdAt: Date;
}

export interface AiSupportTicket extends IModel, IDocumentModel<AiSupportTicket> {
  userEmail: string;
  userLower: string;
  subject: string;
  /** Product the question is about — carried into the human queue. */
  product: string;
  status: SupportTicketStatus;
  messages: SupportTicketMessage[];
  /** Set when the AI first line handed off to a human. */
  escalatedAt?: Date | null;
  escalationReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Transport shapes (not persisted)
// ---------------------------------------------------------------------------

export interface AiProviderMessage {
  role: AiRole;
  text: string;
}

export interface AiProviderRequest {
  system: string;
  messages: AiProviderMessage[];
  maxOutputTokens: number;
}

export interface AiProviderCompletion {
  text: string;
  tokensIn: number;
  tokensOut: number;
  provider: string;
  model: string;
  /** True when the answer came from the offline stub rather than a live model. */
  degraded: boolean;
}

export interface AiProvider {
  readonly id: string;
  readonly model: string;
  /** False when the provider has no credentials configured. */
  readonly configured: boolean;
  complete(request: AiProviderRequest): Promise<AiProviderCompletion>;
}

export interface AiTool {
  id: string;
  title: string;
  icon: string;
  prompt: string;
  /** Requires the high-risk disclaimer banner. */
  disclaimer?: boolean;
  comingSoon?: boolean;
  /** Extra system-prompt guidance for this tool. */
  system?: string;
}
