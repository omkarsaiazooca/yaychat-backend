import { ServiceBase } from "./base";
import aiSupportTicketSchema, {
  AiSupportTicketModel,
} from "../models/aiSupportTicket";
import { AiSupportTicket } from "../data/aiAssistant";

export class AiSupportTicketService extends ServiceBase<
  AiSupportTicket,
  AiSupportTicketModel
> {
  constructor() {
    super(aiSupportTicketSchema, "AiSupportTicket");
  }

  async listForUser(userLower: string, limit = 50): Promise<AiSupportTicket[]> {
    return this.findPaginated(limit, { updatedAt: -1 }, { userLower }, {});
  }

  /** Human queue: escalated tickets, oldest escalation first. */
  async escalatedQueue(limit = 100): Promise<AiSupportTicket[]> {
    return this.findPaginated(
      limit,
      { escalatedAt: 1 },
      { status: "escalated" },
      {}
    );
  }
}
