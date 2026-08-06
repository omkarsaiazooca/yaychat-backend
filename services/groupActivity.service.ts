import { GroupActivity } from "../data/groupActivity";
import GroupActivitySchema, { GroupActivityModel } from "../models/GroupActivity";
import { ServiceBase } from "./base";

export class GroupActivityService extends ServiceBase<GroupActivity, GroupActivityModel> {
    constructor() {
        super(GroupActivitySchema, "GroupActivity");
    }

    async logVisit(email: string, groupId: string, groupName?: string): Promise<void> {
        await this.create({
            email: String(email).trim().toLowerCase(),
            groupId,
            groupName,
            timestamp: new Date(),
        } as GroupActivity);
    }
}
