import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { GroupActivity } from "../data/groupActivity";

export interface GroupActivityModel extends IDocumentModel<GroupActivity>, GroupActivity {}

const GroupActivitySchema = new Schema(
    {
        email:     { type: String, required: true, lowercase: true, trim: true },
        groupId:   { type: String, required: true },
        groupName: { type: String },
        timestamp: { type: Date, default: Date.now },
    },
    { timestamps: false }
);

GroupActivitySchema.index({ groupId: 1, timestamp: -1 });
GroupActivitySchema.index({ email: 1, groupId: 1, timestamp: -1 });

export default GroupActivitySchema;
