import { ServiceBase } from "./base";
import ChatUserBlockSchema, { ChatUserBlockModel } from "../models/chatUserBlock";
import { ChatUserBlock } from "../data/chatUserBlock";

export class ChatUserBlockService extends ServiceBase<
  ChatUserBlock,
  ChatUserBlockModel
> {
  constructor() {
    super(ChatUserBlockSchema, "ChatUserBlock");
  }

  async isBlocked(
    blockerEmail: string,
    blockedEmail: string,
    groupId?: string | null
  ): Promise<boolean> {
    const blockerLower = String(blockerEmail || "").trim().toLowerCase();
    const blockedLower = String(blockedEmail || "").trim().toLowerCase();
    if (!blockerLower || !blockedLower) return false;
    const gid = typeof groupId === "string" ? String(groupId).trim() : null;
    const existing = await this.findOne({ blockerLower, blockedLower, groupId: gid });
    return !!existing;
  }

  async getBlockedLowerList(
    blockerEmail: string,
    groupId?: string | null
  ): Promise<string[]> {
    const blockerLower = String(blockerEmail || "").trim().toLowerCase();
    if (!blockerLower) return [];
    const gid = typeof groupId === "string" ? String(groupId).trim() : null;
    const rows = await this.find({ blockerLower, groupId: gid });
    const blocked = (rows || [])
      .map((r: any) => String(r?.blockedLower || "").trim().toLowerCase())
      .filter(Boolean);
    return Array.from(new Set(blocked));
  }

  async getBlockerLowerListForBlocked(
    blockedEmail: string,
    groupId?: string | null
  ): Promise<string[]> {
    const blockedLower = String(blockedEmail || "").trim().toLowerCase();
    if (!blockedLower) return [];
    const gid = typeof groupId === "string" ? String(groupId).trim() : null;
    const rows = await this.find({ blockedLower, groupId: gid });
    const blockers = (rows || [])
      .map((r: any) => String(r?.blockerLower || "").trim().toLowerCase())
      .filter(Boolean);
    return Array.from(new Set(blockers));
  }

  async getBlockedLowerListForGroupOrDirect(
    blockerEmail: string,
    groupId: string
  ): Promise<string[]> {
    const blockerLower = String(blockerEmail || "").trim().toLowerCase();
    const gid = String(groupId || "").trim();
    if (!blockerLower || !gid) return [];
    const rows = await this.find({ blockerLower, groupId: { $in: [null, gid] } });
    const blocked = (rows || [])
      .map((r: any) => String(r?.blockedLower || "").trim().toLowerCase())
      .filter(Boolean);
    return Array.from(new Set(blocked));
  }

  async getBlockerLowerListForBlockedInGroupOrDirect(
    blockedEmail: string,
    groupId: string
  ): Promise<string[]> {
    const blockedLower = String(blockedEmail || "").trim().toLowerCase();
    const gid = String(groupId || "").trim();
    if (!blockedLower || !gid) return [];
    const rows = await this.find({ blockedLower, groupId: { $in: [null, gid] } });
    const blockers = (rows || [])
      .map((r: any) => String(r?.blockerLower || "").trim().toLowerCase())
      .filter(Boolean);
    return Array.from(new Set(blockers));
  }

  async isBlockedEitherDirection(
    a: string,
    b: string,
    groupId?: string | null
  ): Promise<boolean> {
    const aLower = String(a || "").trim().toLowerCase();
    const bLower = String(b || "").trim().toLowerCase();
    if (!aLower || !bLower) return false;
    const gid = groupId ? String(groupId).trim() : null;
    const existing = await this.findOne({
      $or: [
        { blockerLower: aLower, blockedLower: bLower, groupId: gid },
        { blockerLower: bLower, blockedLower: aLower, groupId: gid },
      ],
    });
    return !!existing;
  }

  async isBlockedInGroup(email: string, groupId: string): Promise<boolean> {
    const lower = String(email || "").trim().toLowerCase();
    const gid = String(groupId || "").trim();
    if (!lower || !gid) return false;
    const existing = await this.findOne({ blockedLower: lower, groupId: gid });
    return !!existing;
  }

  async hasPreventSendingGroupModerationBlock(
    email: string,
    groupId: string
  ): Promise<boolean> {
    const blockedLower = String(email || "").trim().toLowerCase();
    const gid = String(groupId || "").trim();
    if (!blockedLower || !gid) return false;

    const existing = await this.findOne({
      blockedLower,
      groupId: gid,
      preventSending: true,
      blockedByAdmin: true,
      blockScope: "group_moderation",
    });
    return !!existing;
  }
}
