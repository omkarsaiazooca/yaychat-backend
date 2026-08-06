// services/dailyAdStreak.service.ts
import dailyAdStreakSchema, { DailyAdStreakModel } from "../models/dailyAdStreak";
import { DailyAdStreak } from "../data/dailyAds";
import { ServiceBase } from "./base";
import { ymdInSystemTz } from "../helpers/dayHelper";

const prevDay = (d: string) => {
  const dt = new Date(d + "T00:00:00Z"); dt.setUTCDate(dt.getUTCDate() - 1);
  return ymdInSystemTz(dt);
};

export class DailyAdStreakService extends ServiceBase<DailyAdStreak, DailyAdStreakModel> {
  constructor() { super(dailyAdStreakSchema, "DailyAdStreak"); }

  /**
   * Call this ONCE when a day reaches 25/25.
   * If consecutively after yesterday, increment (cap 7). Else reset to 1.
   */
  async onDayCompleted(email: string, date: string) {
    const emailL = String(email).toLowerCase();
    const s = await this.findOne({ email: emailL });
    if (!s) {
      await this.upsertOne({ email: emailL }, { $set: { currentDay: 1, lastCompletedDate: date } });
      return { currentDay: 1, lastCompletedDate: date };
    }

    const isConsecutive = s.lastCompletedDate === prevDay(date);
    const nextDay = isConsecutive ? Math.min((s.currentDay || 0) + 1, 7) : 1;

    await this.updatePart(
      { email: emailL },
      { $set: { currentDay: nextDay, lastCompletedDate: date } }
    );
    return { currentDay: nextDay, lastCompletedDate: date };
  }

  /**
   * What “day” should UI show for TODAY?
   * - If last completed === today   -> show s.currentDay
   * - If last completed === yesterday -> show min(s.currentDay+1, 7)
   * - Else -> 1 (reset)
   */
  async getEffectiveDayForToday(email: string, now = new Date()) {
    const emailL = String(email).toLowerCase();
    const today = ymdInSystemTz(now);
    const yday  = prevDay(today);
    const s = await this.findOne({ email: emailL });

    if (!s || !s.lastCompletedDate) return 1;
    if (s.lastCompletedDate === today) return Math.max(s.currentDay || 1, 1);
    if (s.lastCompletedDate === yday)  return Math.min((s.currentDay || 0) + 1, 7);
    return 1; // missed a day → reset view to Day 1
  }

  async getEmailsWithStreaks(minDays: number) {
    return this.findSelect({ currentDay: { $gte: minDays } }, { email: 1, currentDay: 1, _id: 0 });
  }
}
