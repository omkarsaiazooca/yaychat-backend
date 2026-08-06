import { UserMiningSession } from "../data/userMiningSession";
import UserMiningSessionSchema, { UserMiningSessionDocument } from "../models/userMiningSession";
import { ServiceBase } from "./base";

export class UserMiningSessionService extends ServiceBase<UserMiningSession, UserMiningSessionDocument> {
    constructor() {
        super(UserMiningSessionSchema, "UserMiningSession");
    }
}