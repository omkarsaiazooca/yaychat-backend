export interface SpecialMiningEligibility {
  email: string;
  specialMiningEligible: boolean;
  skipMiningAds: boolean;
  sessionHours: number;
  reason: string;
  addedBy?: string | null;
  addedAt: Date;
  notes?: string | null;
}
