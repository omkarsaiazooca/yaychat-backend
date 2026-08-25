import { Request, Response } from "express";
import { randomUUID } from "crypto";
import {
  AI_TOOLS,
  ASSIST_SYSTEM_PROMPTS,
  SUGGESTED_PROMPTS,
} from "../services/ai/catalog";
import { DISCLAIMERS } from "../services/ai/safety";
import {
  AiAssistantService,
  AiServiceError,
  planFor,
} from "../services/aiAssistant.service";
import { AiAssistantReportService } from "../services/aiAssistantReport.service";
import { AiSupportTicketService } from "../services/aiSupportTicket.service";

const aiService = new AiAssistantService();
const reportService = new AiAssistantReportService();
const ticketService = new AiSupportTicketService();

const emailOf = (req: Request): string =>
  String((req as any).user?.email || "").trim();

/** Mongo throws a CastError on a malformed `_id`; treat those as "not found". */
const isObjectId = (value: string): boolean => /^[0-9a-fA-F]{24}$/.test(value);

const failed = (res: Response, error: any) => {
  if (error instanceof AiServiceError) {
    return res
      .status(error.status)
      .json({ message: error.message, code: error.code });
  }
  console.error("[ai] unhandled error", error);
  return res.status(500).json({ message: "The AI service is unavailable right now." });
};

export class AiAssistantController {
  constructor() {
    // Express strips `this` when handlers are passed as bare references.
    const self = this as any;
    for (const key of Object.getOwnPropertyNames(AiAssistantController.prototype)) {
      if (key !== "constructor" && typeof self[key] === "function") {
        self[key] = self[key].bind(this);
      }
    }
  }

  /** Tools, prompts, quota, and live provider status for the AI hub. */
  async getConfig(req: Request, res: Response) {
    try {
      const status = aiService.status(String(req.query.plan || "free"));
      return res.status(200).json({
        data: {
          tools: AI_TOOLS.map(({ system, ...tool }) => tool),
          suggestedPrompts: SUGGESTED_PROMPTS,
          disclaimers: DISCLAIMERS,
          ...status,
        },
      });
    } catch (error) {
      return failed(res, error);
    }
  }

  async getUsage(req: Request, res: Response) {
    try {
      const email = emailOf(req);
      const plan = planFor(String(req.query.plan || "free"));
      const usage = await aiService.usage(email.toLowerCase(), plan.id);
      return res.status(200).json({
        data: {
          plan: plan.id,
          planLabel: plan.label,
          usedRequests: usage.requests,
          totalRequests: plan.dailyRequests,
          tokensIn: usage.tokensIn,
          tokensOut: usage.tokensOut,
          costUsd: usage.costUsd,
          costCapUsd: plan.dailyCostUsd,
          resetsAt: `${usage.day}T24:00:00Z`,
        },
      });
    } catch (error) {
      return failed(res, error);
    }
  }

  async getConsent(req: Request, res: Response) {
    try {
      const consent = await aiService.consent(emailOf(req).toLowerCase());
      return res.status(200).json({ data: consent });
    } catch (error) {
      return failed(res, error);
    }
  }

  async updateConsent(req: Request, res: Response) {
    try {
      const consent = await aiService.updateConsent(
        emailOf(req).toLowerCase(),
        req.body || {}
      );
      return res.status(200).json({ data: consent });
    } catch (error) {
      return failed(res, error);
    }
  }

  async listConversations(req: Request, res: Response) {
    try {
      const items = await aiService.history(emailOf(req).toLowerCase());
      return res.status(200).json({ data: items });
    } catch (error) {
      return failed(res, error);
    }
  }

  async getConversation(req: Request, res: Response) {
    try {
      const conversation = await aiService.conversation(
        emailOf(req).toLowerCase(),
        String(req.params.conversationId)
      );
      return res.status(200).json({ data: conversation });
    } catch (error) {
      return failed(res, error);
    }
  }

  async createConversation(req: Request, res: Response) {
    try {
      const conversation = await aiService.startConversation(
        emailOf(req),
        String(req.body?.tool || "ask"),
        typeof req.body?.firstPrompt === "string" ? req.body.firstPrompt : undefined
      );
      return res.status(201).json({ data: conversation });
    } catch (error) {
      return failed(res, error);
    }
  }

  async sendMessage(req: Request, res: Response) {
    try {
      const result = await aiService.sendMessage({
        userEmail: emailOf(req),
        conversationId: String(req.params.conversationId),
        prompt: String(req.body?.text || ""),
        planId: String(req.body?.plan || "free"),
      });
      return res.status(200).json({ data: result });
    } catch (error) {
      return failed(res, error);
    }
  }

  async setSaved(req: Request, res: Response) {
    try {
      const conversation = await aiService.setSaved(
        emailOf(req).toLowerCase(),
        String(req.params.conversationId),
        Boolean(req.body?.saved)
      );
      return res.status(200).json({ data: conversation });
    } catch (error) {
      return failed(res, error);
    }
  }

  async deleteConversation(req: Request, res: Response) {
    try {
      await aiService.deleteConversation(
        emailOf(req).toLowerCase(),
        String(req.params.conversationId)
      );
      return res.status(200).json({ message: "Conversation deleted" });
    } catch (error) {
      return failed(res, error);
    }
  }

  /**
   * One-shot assist over content shared from a chat or community.
   * `scope` decides which consent switch must already be on.
   */
  async assist(req: Request, res: Response) {
    try {
      const kind = String(req.body?.kind || "");
      const system = ASSIST_SYSTEM_PROMPTS[kind];
      if (!system) {
        return res.status(400).json({
          message: `Unknown assist kind "${kind}".`,
          code: "validation",
        });
      }
      const scope = req.body?.scope === "community" ? "community" : "chat";
      const answer = await aiService.assist({
        userEmail: emailOf(req),
        system,
        prompt: String(req.body?.content || ""),
        scope,
        planId: String(req.body?.plan || "free"),
      });
      return res.status(200).json({ data: answer });
    } catch (error) {
      return failed(res, error);
    }
  }

  /** Report an AI answer for review. */
  async reportAnswer(req: Request, res: Response) {
    try {
      const reason = String(req.body?.reason || "").trim();
      if (!reason) {
        return res
          .status(400)
          .json({ message: "A reason is required.", code: "validation" });
      }
      const report = await reportService.create({
        userLower: emailOf(req).toLowerCase(),
        conversationId: req.body?.conversationId || null,
        messageId: req.body?.messageId || null,
        reason,
        excerpt: String(req.body?.excerpt || "").slice(0, 2000),
        status: "open",
      } as any);
      return res
        .status(201)
        .json({ message: "Report received", data: report });
    } catch (error) {
      return failed(res, error);
    }
  }

  // -------------------------------------------------------------------------
  // Support desk
  // -------------------------------------------------------------------------

  async listTickets(req: Request, res: Response) {
    try {
      const tickets = await ticketService.listForUser(emailOf(req).toLowerCase());
      return res.status(200).json({ data: tickets });
    } catch (error) {
      return failed(res, error);
    }
  }

  /** Open a ticket and answer it with the AI first line in one round trip. */
  async createTicket(req: Request, res: Response) {
    try {
      const email = emailOf(req);
      const text = String(req.body?.text || "").trim();
      if (!text) {
        return res
          .status(400)
          .json({ message: "Describe the problem first.", code: "validation" });
      }

      const answer = await aiService.supportReply({
        userEmail: email,
        history: [],
        prompt: text,
        planId: String(req.body?.plan || "free"),
      });

      const now = new Date();
      const ticket = await ticketService.create({
        userEmail: email,
        userLower: email.toLowerCase(),
        subject: String(req.body?.subject || text).slice(0, 120),
        product: String(req.body?.product || "YaysApp"),
        status: "ai_handling",
        messages: [
          { messageId: randomUUID(), author: "user", text, createdAt: now },
          {
            messageId: randomUUID(),
            author: "ai",
            text: answer.text,
            createdAt: now,
          },
        ],
      } as any);

      return res.status(201).json({ data: { ticket, answer } });
    } catch (error) {
      return failed(res, error);
    }
  }

  /** Follow-up turn on an existing ticket, answered by the AI first line. */
  async replyToTicket(req: Request, res: Response) {
    try {
      const email = emailOf(req);
      const text = String(req.body?.text || "").trim();
      if (!text) {
        return res
          .status(400)
          .json({ message: "A message is required.", code: "validation" });
      }

      const ticketId = String(req.params.ticketId);
      const ticket = isObjectId(ticketId)
        ? await ticketService.findOne({ _id: ticketId, userLower: email.toLowerCase() })
        : null;
      if (!ticket) {
        return res
          .status(404)
          .json({ message: "Ticket not found.", code: "not_found" });
      }

      const now = new Date();
      const userMessage = {
        messageId: randomUUID(),
        author: "user" as const,
        text,
        createdAt: now,
      };

      // Once a human owns the ticket the AI stops replying — the message is
      // queued for the agent instead.
      if (ticket.status === "escalated") {
        const queued = await ticketService.findOneUpdate(
          { _id: ticket._id },
          { $push: { messages: userMessage } },
          { new: true }
        );
        return res.status(200).json({ data: { ticket: queued, answer: null } });
      }

      const answer = await aiService.supportReply({
        userEmail: email,
        history: ticket.messages
          .filter((message) => message.author !== "agent")
          .map((message) => ({
            role: message.author === "user" ? ("user" as const) : ("assistant" as const),
            text: message.text,
          })),
        prompt: text,
        planId: String(req.body?.plan || "free"),
      });

      const updated = await ticketService.findOneUpdate(
        { _id: ticket._id },
        {
          $push: {
            messages: {
              $each: [
                userMessage,
                {
                  messageId: randomUUID(),
                  author: "ai",
                  text: answer.text,
                  createdAt: now,
                },
              ],
            },
          },
          $set: { status: "ai_handling" },
        },
        { new: true }
      );

      return res.status(200).json({ data: { ticket: updated, answer } });
    } catch (error) {
      return failed(res, error);
    }
  }

  /** Hand the ticket to the human queue, carrying the full AI transcript. */
  async escalateTicket(req: Request, res: Response) {
    try {
      const email = emailOf(req);
      const ticketId = String(req.params.ticketId);
      const ticket = isObjectId(ticketId)
        ? await ticketService.findOne({ _id: ticketId, userLower: email.toLowerCase() })
        : null;
      if (!ticket) {
        return res
          .status(404)
          .json({ message: "Ticket not found.", code: "not_found" });
      }

      const updated = await ticketService.findOneUpdate(
        { _id: ticket._id },
        {
          $set: {
            status: "escalated",
            escalatedAt: new Date(),
            escalationReason:
              String(req.body?.reason || "").trim() || "Requested by the user",
          },
        },
        { new: true }
      );

      return res
        .status(200)
        .json({ message: "Escalated to a human agent", data: updated });
    } catch (error) {
      return failed(res, error);
    }
  }
}
