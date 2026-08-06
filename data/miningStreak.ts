import { IDocumentModel, IModel } from "./base";

export interface MiningStreak extends IModel, IDocumentModel<MiningStreak> {
  email: string;
  currentStreak: number;                 // 0..7 (0 = no completed day yet)
  lastCycleStartedAt?: Date | null;      // start time of last COMPLETED day-cycle
  activeCycleStartedAt?: Date | null;    // start time of the current IN-PROGRESS cycle
  completedSessionsToday?: number;       // sessions accumulated in active cycle
  completedHoursToday?: number;          // hours accumulated in active cycle
  requiredSessionsToday?: number;        // required sessions for current plan
}
