import { ChatGroup } from "../data/ChatMessage";
import ChatGroupSchema, { ChatGroupModel } from "../models/ChatGroups";
import { ServiceBase } from "./base";
import { v1 as uuidv1 } from "uuid";

const EVERYONE_GROUP_ID = "1596e5c0-7eb0-11f0-89eb-753fe21ceabe";
const EVERYONE_GROUP_NAME = "Bitcoin Yay General";

const normalizeEmail = (email: unknown) =>
  String(email ?? "").trim().toLowerCase();

const normalizeEmailList = (emails: unknown[]) =>
  Array.from(
    new Set(
      emails
        .map((email: unknown) => normalizeEmail(email))
        .filter((email: string) => email.length > 0)
    )
  );

export class ChatGroupService extends ServiceBase<ChatGroup, ChatGroupModel> {
  constructor() {
    super(ChatGroupSchema, "ChatGroup");
  }


  async ensureAllUsersGroup(allUserEmails: string[], createdByEmail: string) {
    const name = "All Users";

    // upsert-like behavior
    const existing = await this.findOne({ name });
    if (existing) {
      // keep it global & merge members (emails)
      await this.updatePart(
        { _id: (existing as any)._id },
        {
          $set: { isGlobal: true },
          $addToSet: { members: { $each: allUserEmails } }
        }
      );
      return this.findOne({ _id: (existing as any)._id });
    }

    // create if not found
    return this.create({
      name,
      isGlobal: true,
      createdByEmail,
      members: allUserEmails
    } as any);
  }

  // Helper: add member by email to a group (by name)
  async addMemberByEmail(groupName: string, memberEmail: string) {
    return this.updatePart(
      { name: groupName },
      { $addToSet: { members: memberEmail } }
    );
  }

  async ensureGlobalGroup(name = "General") {
    const existing = await this.findOne({ name });
    if (existing) return this.findById(existing.groupId) as Promise<ChatGroup>;
    const groupData = {
      name: name,
      createdBy: "Admin",
      members: [],
      isReferralGroup: true,
      referralCode: "",
      groupId: uuidv1(),
      isGlobal: true
    };

    return this.create(groupData);
  };

  async ensureMemberEmail(groupId: string, email: string) {
    email = String(email || "").trim().toLowerCase();
    return this.updatePart(
      { groupId },
      { $addToSet: { members: email } }      // store email
    );
  }

  async getDefaultGroups() {
    return this.find({ isGlobal: true });
  }

  async getMemberEmails(groupId: string): Promise<string[]> {
    const g = await this.findOne({ groupId });
    if (!g) return [];
    const members = Array.isArray((g as any).members) ? (g as any).members : [];
    return members.map((m: any) => String(m).toLowerCase()).filter(Boolean);
  }

  // Helper: remove member by email (by groupId)
  async removeMemberByEmail(groupId: string, memberEmail: string) {
    return this.updatePart(
      { groupId: groupId },
      { $pull: { members: memberEmail } }
    );
  }

  async getGroupByName(name: string): Promise<ChatGroup | null> {
    return this.findOne({ name });
  }

  /**
   * Creates a referral group if the name doesn't already exist
   */
  async createReferralGroup(createdBy: string, referralCode: string, name?: string): Promise<ChatGroup> {
    const groupName = name || `Referral Team - ${referralCode}`;

    // Check for duplicate group name
    const existing = await this.findOne({ name: groupName });
    if (existing) {
      throw new Error("Group with this name already exists");
    }

    const groupData = {
      name: groupName,
      createdBy,
      members: [createdBy],
      isReferralGroup: true,
      referralCode,
      groupId: uuidv1(),
      isGlobal: false
    };

    return this.create(groupData);
  }

  /**
   * Add a user to a group by group name
   */
  async addMemberToGroup(groupName: string, userId: string): Promise<ChatGroup | null> {
    return this.updatePart(
      { name: groupName },
      { $addToSet: { members: userId } }
    );
  }

  /**
   * Remove a user from group using group ID
   */
  async removeMember(groupId: string, userId: string): Promise<ChatGroup | null> {
    return this.updatePart(
      { groupId: groupId },
      { $pull: { members: userId } }
    );
  }

  /**
   * Get all groups a user is a member of
   */
  async getUserGroups(email: string): Promise<ChatGroup[]> {
    return this.find({
      $or: [
        { members: email },         // user’s own groups
        { isGlobal: true },         // global groups (if you added this flag)
        { name: "Bitcoin Yay" }  // fallback by name if isGlobal isn’t in your schema
      ]
    });
  }

  /**
   * Get a group by referral code
   */
  async getGroupByReferralCode(referralCode: string): Promise<ChatGroup | null> {
    return this.findOne({ referralCode });
  }

  /**
   * Update last message and timestamp
   */
  async updateLastMessage(groupId: string, message: string): Promise<ChatGroup | null> {
    return this.updatePart(
      { groupId: groupId },
      {
        lastMessage: message,
        lastMessageAt: new Date(),
      }
    );
  }

  /**
   * Search groups by name containing a string and where user is a member
   */
  async searchGroups(query: string, userId: string): Promise<ChatGroup[]> {
    return this.find({
      name: { $regex: query, $options: "i" },
      members: userId,
    });
  }

  async isGroupMember(groupId: string, userId?: string, email?: string): Promise<boolean> {
    if (!groupId) return false;
    if (groupId === EVERYONE_GROUP_ID) return true;

    const or: any[] = [];
    if (email) or.push({ members: String(email).toLowerCase() });
    if (userId) or.push({ members: userId });

    const q: any = { groupId };
    if (or.length) q.$or = or;

    const group = await this.findOne(q);
    return !!group;
  }


  async getEveryoneGroup() {
    return (
      (await this.findOne({ groupId: EVERYONE_GROUP_ID })) ||
      (await this.findOne({ name: EVERYONE_GROUP_NAME }))
    );
  }

  /**
   * Creates an admin-only group that is visible to all users but only admins can send messages
   */
  async createAdminOnlyGroup(name: string, createdBy: string): Promise<ChatGroup> {
    // Check for duplicate group name
    const existing = await this.findOne({ name });
    if (existing) {
      throw new Error("Group with this name already exists");
    }

    const groupData = {
      name,
      createdBy,
      members: [ createdBy ], // Empty - all users implicitly included via isGlobal
      isReferralGroup: false,
      isGlobal: true, // Visible to all users
      isAdminOnly: true, // Only admins can send messages
      groupId: uuidv1(),
    };

    return this.create(groupData);
  }

  /**
   * Updates an admin-only group (name, etc.)
   */
  async updateAdminOnlyGroup(groupId: string, updates: Partial<ChatGroup>): Promise<ChatGroup | null> {
    // Ensure we don't accidentally change critical flags
    const allowedUpdates = {
      name: updates.name,
      lastMessage: updates.lastMessage,
      lastMessageAt: updates.lastMessageAt,
    };

    // Remove undefined values
    Object.keys(allowedUpdates).forEach(key => 
      allowedUpdates[key as keyof typeof allowedUpdates] === undefined && 
      delete allowedUpdates[key as keyof typeof allowedUpdates]
    );

    // First find the group to get its _id
    const group = await this.findOne({ groupId, isAdminOnly: true });
    if (!group) {
      throw new Error("Admin-only group not found");
    }

    const updated = await this.updatePart({ _id: (group as any)._id }, { $set: allowedUpdates });
    return updated;
  }

  /**
   * Gets all admin-only groups
   */
  async getAdminOnlyGroups(): Promise<ChatGroup[]> {
    return this.find({ isAdminOnly: true });
  }

  /**
   * Creates a custom group with specified members
   */
  async createCustomGroup(creatorEmail: string, groupName: string, memberEmails: string[]): Promise<ChatGroup> {
    const creator = normalizeEmail(creatorEmail);
    const members = normalizeEmailList([creator, ...memberEmails]);

    const groupData = {
      name: groupName,
      createdBy: creator,
      members, // Include creator and specified members
      isReferralGroup: false,
      referralCode: "", // Empty referral code
      groupId: uuidv1(),
      isGlobal: false
    };

    return this.create(groupData);
  }

  async updateGroupMetadata(groupId: string, updates: { name?: string }): Promise<ChatGroup | null> {
    const safeUpdates: Record<string, any> = {};
    if (typeof updates.name === "string" && updates.name.trim()) {
      safeUpdates.name = updates.name.trim();
    }

    if (!Object.keys(safeUpdates).length) {
      return this.findOne({ groupId });
    }

    await this.updatePart({ groupId }, { $set: safeUpdates });
    return this.findOne({ groupId });
  }

  async deleteGroupByGroupId(groupId: string) {
    return this.deleteOne({ groupId });
  }

  async addMembers(groupId: string, identifiers: string[]): Promise<ChatGroup | null> {
    const unique = Array.from(
      new Set(
        identifiers
          .filter(Boolean)
          .map((id) => String(id).trim())
          .filter((id) => id.length)
      )
    );

    if (!unique.length) {
      return this.findOne({ groupId });
    }

    await this.updatePart(
      { groupId },
      { $addToSet: { members: { $each: unique } } }
    );

    return this.findOne({ groupId });
  }

  async removeMembers(groupId: string, identifiers: string[]): Promise<ChatGroup | null> {
    const unique = Array.from(
      new Set(
        identifiers
          .filter(Boolean)
          .map((id) => String(id).trim())
          .filter((id) => id.length)
      )
    );

    if (!unique.length) {
      return this.findOne({ groupId });
    }

    await this.updatePart(
      { groupId },
      { $pull: { members: { $in: unique } } }
    );

    return this.findOne({ groupId });
  }

  async setMessagingBlocked(
    groupId: string,
    blocked: boolean,
    opts: { by: string; reason?: string }
  ): Promise<ChatGroup | null> {
    const setPayload: Record<string, any> = {
      isMessagingBlocked: blocked,
    };
    const unsetPayload: Record<string, any> = {};

    if (blocked) {
      setPayload.messagingBlockedBy = opts.by;
      setPayload.messagingBlockedAt = new Date();
      if (opts.reason && opts.reason.trim()) {
        setPayload.messagingBlockedReason = opts.reason.trim();
      } else {
        unsetPayload.messagingBlockedReason = "";
      }
    } else {
      setPayload.messagingBlockedBy = null;
      setPayload.messagingBlockedAt = null;
      unsetPayload.messagingBlockedReason = "";
    }

    const update: any = { $set: setPayload };
    if (Object.keys(unsetPayload).length) {
      update.$unset = unsetPayload;
    }

    await this.updatePart({ groupId }, update);
    return this.findOne({ groupId });
  }

  async blockMember(groupId: string, email: string): Promise<ChatGroup | null> {
    const normalized = String(email || "").trim().toLowerCase();
    if (!normalized) {
      return this.findOne({ groupId });
    }

    await this.updatePart(
      { groupId },
      { $addToSet: { blockedMembers: normalized } }
    );

    return this.findOne({ groupId });
  }

  async unblockMember(groupId: string, email: string): Promise<ChatGroup | null> {
    const normalized = String(email || "").trim().toLowerCase();
    if (!normalized) {
      return this.findOne({ groupId });
    }

    await this.updatePart(
      { groupId },
      { $pull: { blockedMembers: normalized } }
    );

    return this.findOne({ groupId });
  }

  async isMemberBlocked(groupId: string, email: string): Promise<boolean> {
    const normalized = String(email || "").trim().toLowerCase();
    if (!normalized) return false;

    const group = await this.findOne({
      groupId,
      blockedMembers: normalized,
    });

    return !!group;
  }

}
