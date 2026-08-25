import { randomUUID } from "crypto";
import { ServiceBase } from "./base";
import yaysCommunityPollSchema, {
  YaysCommunityPollModel,
} from "../models/yaysCommunityPoll";
import { CommunityPoll } from "../data/yaysCommunities";

const lower = (value: unknown) => String(value ?? "").trim().toLowerCase();

export const MAX_POLL_OPTIONS = 8;

export class YaysCommunityPollService extends ServiceBase<
  CommunityPoll,
  YaysCommunityPollModel
> {
  constructor() {
    super(yaysCommunityPollSchema, "YaysCommunityPoll");
  }

  async open(input: {
    communityId: string;
    createdByLower: string;
    question: string;
    options: string[];
    closesAt: Date;
  }): Promise<CommunityPoll> {
    const options = input.options
      .map((label) => String(label || "").trim())
      .filter(Boolean)
      .slice(0, MAX_POLL_OPTIONS)
      .map((label) => ({ label, votes: 0 }));
    return this.create({
      pollId: randomUUID(),
      communityId: input.communityId,
      createdByLower: lower(input.createdByLower),
      question: String(input.question).trim(),
      options,
      voters: [],
      closesAt: input.closesAt,
    } as CommunityPoll);
  }

  async listFor(communityId: string): Promise<CommunityPoll[]> {
    return this.findPaginated(20, { createdAt: -1 }, { communityId }, {});
  }

  async byPollId(pollId: string): Promise<CommunityPoll | null> {
    return this.findOne({ pollId });
  }

  /**
   * Record one vote.
   *
   * The "already voted" check is enforced by the query — `voters.userLower`
   * must not already contain this person — so a double-tap or a retried request
   * cannot add two votes.
   */
  async vote(
    pollId: string,
    userLower: string,
    optionIndex: number
  ): Promise<{ ok: boolean; reason?: "closed" | "voted" | "option" | "missing" }> {
    const email = lower(userLower);
    const poll = await this.byPollId(pollId);
    if (!poll) {
      return { ok: false, reason: "missing" };
    }
    if (new Date(poll.closesAt).getTime() <= Date.now()) {
      return { ok: false, reason: "closed" };
    }
    if (!poll.options[optionIndex]) {
      return { ok: false, reason: "option" };
    }
    if ((poll.voters || []).some((voter) => voter.userLower === email)) {
      return { ok: false, reason: "voted" };
    }
    const updated = await this.findOneUpdate(
      { pollId, "voters.userLower": { $ne: email } },
      {
        $inc: { [`options.${optionIndex}.votes`]: 1 },
        $push: { voters: { userLower: email, optionIndex } },
      },
      { new: true }
    );
    return updated ? { ok: true } : { ok: false, reason: "voted" };
  }

  async close(pollId: string): Promise<void> {
    await this.updatePart({ pollId }, { $set: { closesAt: new Date() } });
  }
}
