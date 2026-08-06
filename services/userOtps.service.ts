import { userOtps } from '../data/userOtp';
import userOtpsSchema, { UserOtpsModel } from "../models/usersOtps";
import { ServiceBase } from "./base";

export class UserOtpsService extends ServiceBase<userOtps, UserOtpsModel> {
    constructor() {
        super(userOtpsSchema, "UserOtps");
    }

}