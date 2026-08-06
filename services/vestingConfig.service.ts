import { VestingConfig } from "../data/vestingConfig";
import VestingConfigSchema, { VestingConfigModel } from "../models/vestingConfig";
import { ServiceBase } from "./base";

export class VestingConfigService extends ServiceBase<VestingConfig, VestingConfigModel> {
  constructor() {
    super(VestingConfigSchema, "VestingConfig");
  }

     // Get all available vesting options
     async getAllVestingOptions(coinSymbol: string) {
        return await this.find({coinSymbol});
    }
}