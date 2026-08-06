import { Schema, Document, model } from "mongoose";
import { VestingConfig } from "../data/vestingConfig";
import { UserVestingConfig } from "../data/userVestingConfig";

export interface UserVestingConfigModel extends Document, UserVestingConfig {}

const UserVestingConfigSchema = new Schema<UserVestingConfigModel>({
  email: { type: String },
  option: { type: String },
  startDate: { type: Date },
  nextChangeAllowed: { type: Date },
  coinSymbol: { type: String },
});

export default UserVestingConfigSchema;
