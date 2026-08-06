import { GroupReadState } from "../data/groupReadState";
import GroupReadStateSchema, { GroupReadStateModel } from "../models/groupReadState";
import { ServiceBase } from "./base";
import { GroupActivityService } from "./groupActivity.service";

const norm = (e: string) => String(e || "").trim().toLowerCase();
const groupActivityService = new GroupActivityService();

export class GroupReadStateService extends ServiceBase<GroupReadState, GroupReadStateModel> {
    constructor() {
        super(GroupReadStateSchema, "GroupReadState");
    }

    // Return the effective lastReadAt after $max
    async markRead(email: string, groupId: string, when: Date, groupName?: string): Promise<Date> {
        const e = String(email || "").trim().toLowerCase();
        const safeWhen = new Date(Math.min(Date.now(), when.getTime()));
        await this.upsertOne(
            { email: e, groupId },
            {
                $max: { lastReadAt: safeWhen },
                $setOnInsert: { email: e, groupId }
            }
        );

        // Log every visit so DAU can be computed accurately per day
        groupActivityService.logVisit(e, groupId, groupName).catch(() => {});

        return safeWhen;
    }
    
    async getLastRead(email: string, groupId: string): Promise<Date> {
        const e = String(email || "").trim().toLowerCase();
        const row = await this.findOne({ email: e, groupId });
        return row?.lastReadAt ? new Date(row.lastReadAt) : new Date(0);
    }
}