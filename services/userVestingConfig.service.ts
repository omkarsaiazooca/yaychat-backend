import { UserVestingConfig } from "../data/userVestingConfig";
import UserVestingConfigSchema, {
  UserVestingConfigModel,
} from "../models/userVestingConfig";
import { ServiceBase } from "./base";
import { VestingConfigService } from "./vestingConfig.service";
const vestingConfigService: VestingConfigService = new VestingConfigService();

export class UserVestingConfigService extends ServiceBase<
  UserVestingConfig,
  UserVestingConfigModel
> {
  constructor() {
    super(UserVestingConfigSchema, "UserVestingConfig");
  }

  // Get user-specific vesting settings
  async getUserVesting(email: string, coinSymbol: string) {
    const userVesting = await this.findOne({ email, coinSymbol: coinSymbol });
    if (userVesting) {
      return userVesting;
    } else {
      const vestingOption = await vestingConfigService.findOne({
        option: "Extended Vesting",
        coinSymbol,
      });
      if (!vestingOption) throw new Error("Invalid vesting option");

      const now = new Date();
      const nextChangeAllowed = new Date(now);
      nextChangeAllowed.setMonth(now.getMonth() + 6); // Allow next change after 6 months
      const newUserVesting = {
        email: email,
        option: "Extended Vesting",
        startDate: now,
        nextChangeAllowed,
        coinSymbol: vestingOption.coinSymbol,
      };
      return await this.create(newUserVesting);
    }
  }

  // Set or Update User Vesting (Only if allowed)
  async setUserVesting(email: string, option: string, coinSymbol: string) {
    const userVesting = await this.findOne({ email, coinSymbol: coinSymbol });

    const vestingOption = await vestingConfigService.findOne({
      option,
      coinSymbol,
    });
    if (!vestingOption) throw new Error("Invalid vesting option");

    const now = new Date();
    const nextChangeAllowed = new Date(now);
    nextChangeAllowed.setMonth(now.getMonth() + 6); // Allow next change after 6 months
    console.log("userVesting", userVesting);
    if (userVesting) {
      if (userVesting.nextChangeAllowed > now) {
        return {
          data: {
            message:
              "You can change your vesting option only once every 6 months",
          },
          status: 500,
        };
      }

      userVesting.option = option;
      userVesting.startDate = now;
      userVesting.nextChangeAllowed = nextChangeAllowed;
      const updateSetting = await this.updatePart(
        {
          email: email,
          coinSymbol: coinSymbol,
        },
        {
          $set: userVesting,
        }
      );
      return {
        data: updateSetting,
        status: 200,
      };
    } else {
      const newUserVesting = {
        email: email,
        option,
        startDate: now,
        nextChangeAllowed,
        coinSymbol: vestingOption.coinSymbol,
      };
      let res = await this.create(newUserVesting);

      return {
        data: res,
        status: 200,
      };
    }
  }
}
