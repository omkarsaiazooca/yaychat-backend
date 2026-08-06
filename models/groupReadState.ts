import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { GroupReadState } from "../data/groupReadState";

export interface GroupReadStateModel extends IDocumentModel<GroupReadState>, GroupReadState { }

const GroupReadStateSchema = new Schema(
    {
        email: { type: String, required: true, lowercase: true, trim: true, index: true },
        groupId: { type: String, required: true, index: true },
        lastReadAt: { type: Date, default: new Date(0) },
    },
    { timestamps: { createdAt: false, updatedAt: "updatedAt" } }
)
GroupReadStateSchema.index({ email: 1, groupId: 1 }, { unique: true });
export default GroupReadStateSchema;