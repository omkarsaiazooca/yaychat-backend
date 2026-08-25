import { ServiceBase } from "./base";
import aiConversationSchema, {
  AiConversationModel,
} from "../models/aiAssistantConversation";
import { AiConversation } from "../data/aiAssistant";

export class AiAssistantConversationService extends ServiceBase<
  AiConversation,
  AiConversationModel
> {
  constructor() {
    super(aiConversationSchema, "AiAssistantConversation");
  }

  /** Newest-first history for one user, excluding soft-deleted threads. */
  async listForUser(userLower: string, limit = 50): Promise<AiConversation[]> {
    return this.findPaginated(
      limit,
      { updatedAt: -1 },
      { userLower, deletedAt: null },
      {}
    );
  }
}
