import { ServiceBase } from "./base";
import whitelistSchema, { WhitelistModelInterface } from "../models/whitelist";
import { Whitelist } from "../data/whitelist";

export class WhitelistService extends ServiceBase<Whitelist, WhitelistModelInterface> {
  constructor() {
    super(whitelistSchema, "Whitelist");
  }

  /**
   * Check if an email is whitelisted
   */
  async isEmailWhitelisted(email: string): Promise<boolean> {
    try {
      // Ensure MongoDB connection before querying
      const { ensureMongoConnected } = require("../db/connection");
      const isConnected = await ensureMongoConnected();
      if (!isConnected) {
        console.error("Error checking whitelist: MongoDB not connected");
        return false;
      }

      const normalizedEmail = email.toLowerCase().trim();
      const whitelistEntry = await this.findOne({ email: normalizedEmail });
      return !!whitelistEntry;
    } catch (error) {
      console.error("Error checking whitelist:", error);
      return false;
    }
  }

  /**
   * Add email to whitelist (with duplicate check)
   */
  async addEmail(email: string, addedBy?: string, notes?: string): Promise<Whitelist> {
    const normalizedEmail = email.toLowerCase().trim();
    
    // Check if already exists
    const existing = await this.findOne({ email: normalizedEmail });
    if (existing) {
      throw new Error("Email already exists in whitelist");
    }

    return await this.create({
      email: normalizedEmail,
      addedBy: addedBy || null,
      addedAt: new Date(),
      notes: notes || null
    } as Whitelist);
  }

  /**
   * Get all whitelisted emails
   */
  async getAllEmails(): Promise<Whitelist[]> {
    return await this.find({});
  }

  /**
   * Remove email from whitelist
   */
  async removeEmail(email: string): Promise<boolean> {
    const normalizedEmail = email.toLowerCase().trim();
    const result = await this.deleteOne({ email: normalizedEmail });
    return !!result;
  }

  /**
   * Update whitelist entry
   */
  async updateEmail(oldEmail: string, newEmail: string, notes?: string): Promise<Whitelist> {
    const normalizedOldEmail = oldEmail.toLowerCase().trim();
    const normalizedNewEmail = newEmail.toLowerCase().trim();

    // Check if new email already exists
    if (normalizedOldEmail !== normalizedNewEmail) {
      const existing = await this.findOne({ email: normalizedNewEmail });
      if (existing) {
        throw new Error("New email already exists in whitelist");
      }
    }

    const updateData: any = { email: normalizedNewEmail };
    if (notes !== undefined) {
      updateData.notes = notes;
    }

    return await this.updatePart(
      { email: normalizedOldEmail },
      { $set: updateData }
    );
  }
}


