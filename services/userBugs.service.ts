import { UserBugs } from "../data/userBugs";
import userBugsSchema, { UserBugsModel } from "../models/userBugs";
import { ServiceBase } from "./base";

export class UserBugsService extends ServiceBase<UserBugs, UserBugsModel> {
    constructor() {
        super(userBugsSchema, "UserBugs");
    }

}