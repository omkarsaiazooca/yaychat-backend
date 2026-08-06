import { UserVestingOperations } from "../platform/vesting.operations";

export class VestingController {
  constructor() {}

  // Fetch all available vesting options
  async getVestingOptionsForCoin(req: any, res: any) {
    try {
      const userVestingOperations: UserVestingOperations =
        new UserVestingOperations(req, res);
      const options = await userVestingOperations.getVestingOptions(req, res);
      res.statusCode = options.status;
      res.send(options);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  // Fetch user-specific vesting settings
  async getUserVesting(req: any, res: any) {
    try {
      const { email } = req.params;
      if (!email) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "Missing required fields" } });
        return;
      }
      const userVestingOperations: UserVestingOperations =
        new UserVestingOperations(req, res);
      const userVesting = await userVestingOperations.getUserVesting(req, res);

      if (!userVesting) {
        res.statusCode = 404;
        res.send({
          status: 404,
          data: { message: "User vesting settings not found" },
        });
        return;
      }

      res.statusCode = userVesting.status;
      res.send(userVesting);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  // Update user vesting option (only allowed once every 6 months)
  async updateUserVesting(req: any, res: any) {
    try {
      const { email, option } = req.body;

      if (!email || !option) {
        res.statusCode = 400;
        res.send({ status: 400, data: { message: "Missing required fields" } });
        return;
      }

      const userVestingOperations: UserVestingOperations =
        new UserVestingOperations(req, res);

      const vestingOption = await userVestingOperations.updateUserVesting(
        req,
        res
      );
      res.statusCode = vestingOption.status;
      res.send(vestingOption);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }
}
