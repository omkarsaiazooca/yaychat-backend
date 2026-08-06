import { UserVestingConfigService } from "../services/userVestingConfig.service";
import { VestingConfigService } from "../services/vestingConfig.service";
import { BaseAPIOperations } from "./base.operations";
import { Request, Response } from "express";
const vestingConfigService: VestingConfigService = new VestingConfigService();
const userVestingConfigService: UserVestingConfigService =
  new UserVestingConfigService();
export class UserVestingOperations extends BaseAPIOperations {
  constructor(req: Request, res: Response) {
    super(req, res);
  }
  async getVestingOptions(req: Request, res: Response) {
    try {
      const { coinSymbol } = req.params;
      const options = await vestingConfigService.getAllVestingOptions(
        coinSymbol
      );
      return { status: 200, data: options };
    } catch (err) {
      console.log(err, "err in add");
      return { status: 500, data: "Failed in check email" };
    }
  }

  // Get the user's vesting settings
  async getUserVesting(req: Request, res: Response) {
    try {
      const { email, coinSymbol } = req.params;

      const userVesting = await userVestingConfigService.getUserVesting(
        email,
        coinSymbol
      );
      return { status: 200, data: userVesting };
    } catch (err) {
      console.log(err, "err in add");
      return { status: 500, data: "Failed in check email" };
    }
  }

  // Change the user's vesting option
  async updateUserVesting(req: Request, res: Response) {
    try {
      const { email, option, coinSymbol } = req.body;
      const updatedVesting = await userVestingConfigService.setUserVesting(
        email,
        option,
        coinSymbol
      );

      return updatedVesting;
    } catch (err) {
      console.log(err, "err in add");
      return { status: 500, data: "Failed in check email" };
    }
  }
}
