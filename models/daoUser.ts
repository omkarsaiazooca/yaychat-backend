import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { DaoUser } from "../data/daoUser";

export interface DaoUserModel extends IDocumentModel<DaoUser>, DaoUser { }

const powerSchema = new Schema({
    name: String,
    status: { type: String, enum: ["completed", "pending", "failed"], default: "pending" }
});

const taskSchema = new Schema({
    taskId: String,
    name: String,
    status: { type: String, enum: ["completed", "pending", "failed"], default: "pending" }
});

const activitySchema = new Schema({
    name: String,
    status: { type: String, enum: ["completed", "failed"], default: "completed" },
    date: Date
});

const voteSchema = new Schema({
    proposalId: String,
    vote: { type: String, enum: ["up", "down"] },
    date: Date
});

const daoUserSchema = new Schema({
    email: { type: String, required: true, unique: true },
    name: String,
    role: { type: String, default: "Contributor Gopher" },
    reputation: { type: Number, default: 0 },
    profileCompletion: { type: Number, default: 0 },
    minedBTCY: { type: Number, default: 0 },
    referralCount: { type: Number, default: 0 },
    verifiedTasksCount: { type: Number, default: 0 },
    ledInitiativesCount: { type: Number, default: 0 },
    powers: { type: [powerSchema], default: [] },
    assignedTasks: { type: [taskSchema], default: [] },
    recentActivity: { type: [activitySchema], default: [] },
    votes: { type: [voteSchema], default: [] },
}, {
    timestamps: true
});

export default daoUserSchema;
