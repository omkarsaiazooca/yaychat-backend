import { randomUUID } from "crypto";
import { ServiceBase } from "./base";
import yaysCommunityJoinRequestSchema, {
  YaysCommunityJoinRequestModel,
} from "../models/yaysCommunityJoinRequest";
import {
  CommunityJoinRequest,
  JoinRequestStatus,
} from "../data/yaysCommunities";

const lower = (value: unknown) => String(value ?? "").trim().toLowerCase();

export class YaysCommunityJoinRequestService extends ServiceBase<
  CommunityJoinRequest,
  YaysCommunityJoinRequestModel
> {
  constructor() {
    super(yaysCommunityJoinRequestSchema, "YaysCommunityJoinRequest");
  }

  /**
   * Raise a request, or return the pending one that already exists.
   *
   * Idempotent because the unique partial index makes a second pending row
   * impossible; catching the duplicate is cheaper (and race-free) than a
   * read-then-write.
   */
  async request(input: {
    communityId: string;
    userLower: string;
    userName: string;
    message?: string;
  }): Promise<CommunityJoinRequest> {
    const userLower = lower(input.userLower);
    const existing = await this.findOne({
      communityId: input.communityId,
      userLower,
      status: "pending",
    });
    if (existing) {
      return existing;
    }
    try {
      return await this.create({
        requestId: randomUUID(),
        communityId: input.communityId,
        userLower,
        userName: input.userName || userLower,
        message: String(input.message || "").slice(0, 500),
        status: "pending",
      } as CommunityJoinRequest);
    } catch (error: any) {
      if (error?.code === 11000) {
        const raced = await this.findOne({
          communityId: input.communityId,
          userLower,
          status: "pending",
        });
        if (raced) {
          return raced;
        }
      }
      throw error;
    }
  }

  async pending(communityId: string): Promise<CommunityJoinRequest[]> {
    return this.findPaginated(200, { createdAt: 1 }, { communityId, status: "pending" }, {});
  }

  async recent(communityId: string, limit = 50): Promise<CommunityJoinRequest[]> {
    return this.findPaginated(limit, { createdAt: -1 }, { communityId }, {});
  }

  async byRequestId(requestId: string): Promise<CommunityJoinRequest | null> {
    return this.findOne({ requestId });
  }

  async decide(
    requestId: string,
    status: Exclude<JoinRequestStatus, "pending">,
    decidedByLower: string
  ): Promise<CommunityJoinRequest | null> {
    await this.updatePart(
      { requestId, status: "pending" },
      {
        $set: {
          status,
          decidedByLower: lower(decidedByLower),
          decidedAt: new Date(),
        },
      }
    );
    return this.byRequestId(requestId);
  }

  async pendingFor(
    communityId: string,
    userLower: string
  ): Promise<CommunityJoinRequest | null> {
    return this.findOne({
      communityId,
      userLower: lower(userLower),
      status: "pending",
    });
  }
}
