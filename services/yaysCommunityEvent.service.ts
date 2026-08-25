import { randomUUID } from "crypto";
import { ServiceBase } from "./base";
import yaysCommunityEventSchema, {
  YaysCommunityEventModel,
} from "../models/yaysCommunityEvent";
import { CommunityEvent } from "../data/yaysCommunities";

const lower = (value: unknown) => String(value ?? "").trim().toLowerCase();

export class YaysCommunityEventService extends ServiceBase<
  CommunityEvent,
  YaysCommunityEventModel
> {
  constructor() {
    super(yaysCommunityEventSchema, "YaysCommunityEvent");
  }

  async schedule(input: {
    communityId: string;
    createdByLower: string;
    title: string;
    description?: string;
    startsAt: Date;
    location?: string;
  }): Promise<CommunityEvent> {
    return this.create({
      eventId: randomUUID(),
      communityId: input.communityId,
      createdByLower: lower(input.createdByLower),
      title: String(input.title).trim(),
      description: String(input.description || "").trim(),
      startsAt: input.startsAt,
      location: String(input.location || "").trim(),
      // The organiser is attending their own event; anything else reads as a bug.
      attendeeLowers: [lower(input.createdByLower)],
      cancelled: false,
    } as CommunityEvent);
  }

  /** Upcoming first; past events drop off the community page after a day. */
  async listFor(communityId: string): Promise<CommunityEvent[]> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return this.findPaginated(
      20,
      { startsAt: 1 },
      { communityId, cancelled: { $ne: true }, startsAt: { $gte: cutoff } },
      {}
    );
  }

  async byEventId(eventId: string): Promise<CommunityEvent | null> {
    return this.findOne({ eventId });
  }

  async setAttending(
    eventId: string,
    userLower: string,
    attending: boolean
  ): Promise<CommunityEvent | null> {
    const email = lower(userLower);
    await this.updatePart(
      { eventId },
      attending
        ? { $addToSet: { attendeeLowers: email } }
        : { $pull: { attendeeLowers: email } }
    );
    return this.byEventId(eventId);
  }

  async cancel(eventId: string): Promise<void> {
    await this.updatePart({ eventId }, { $set: { cancelled: true } });
  }
}
