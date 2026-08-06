import { UserMiningBalance } from "../data/userMiningBalance";
import UserBalanceSchema, { UserBalanceDocument } from "../models/userMiningBalance";
import { ServiceBase } from "./base";

export class UserMiningBalanceService extends ServiceBase<UserMiningBalance, UserBalanceDocument> {
  constructor() {
    super(UserBalanceSchema, "userMiningBalance");
  }
}