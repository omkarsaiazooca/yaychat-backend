import { ServiceBase } from "./base";
import { SpecialMiningEligibility } from "../data/specialMiningEligibility";
import { SpecialMiningEligibilityModel, specialMiningEligibilitySchema } from "../models/specialMiningEligibility";

export class SpecialMiningEligibilityService extends ServiceBase<
  SpecialMiningEligibility,
  SpecialMiningEligibilityModel
> {
  constructor() {
    super(specialMiningEligibilitySchema, "SpecialMiningEligibility");
  }

  async getEligibility(email: string): Promise<SpecialMiningEligibility | null> {
    const normalized = String(email || "").trim().toLowerCase();
    return await this.findOne({ email: normalized });
  }

  async setEligibility(
    email: string,
    data: {
      specialMiningEligible: boolean;
      skipMiningAds: boolean;
      sessionHours?: number;
      reason?: string;
      addedBy?: string;
      notes?: string;
    }
  ): Promise<SpecialMiningEligibility> {
    const normalized = String(email || "").trim().toLowerCase();
    return await this.findOneUpdate(
      { email: normalized },
      {
        $set: {
          specialMiningEligible: data.specialMiningEligible,
          skipMiningAds: data.skipMiningAds,
          sessionHours: data.sessionHours ?? 168,
          reason: data.reason ?? "eligible_email_whitelist",
          addedBy: data.addedBy ?? null,
          notes: data.notes ?? null,
          addedAt: new Date(),
        },
        $setOnInsert: { email: normalized },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  async removeEligibility(email: string): Promise<boolean> {
    const normalized = String(email || "").trim().toLowerCase();
    const result = await this.deleteOne({ email: normalized });
    return !!result;
  }

  async listEligible(): Promise<SpecialMiningEligibility[]> {
    return await this.find({ specialMiningEligible: true });
  }
}
