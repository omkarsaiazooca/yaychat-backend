import { VestingController } from "../controllers/vestingAPI";
import { Router } from "express";

const vestingRouter: Router = Router();
const vestingController = new VestingController();

// Fetch all vesting options
vestingRouter.get(
  "/vesting-options/:coinSymbol",
  vestingController.getVestingOptionsForCoin
);

// Fetch user-specific vesting settings
vestingRouter.get(
  "/user-vesting/:email/:coinSymbol",
  vestingController.getUserVesting
);
// Update vesting settings (Only allowed once every 6 months)
vestingRouter.post("/update-vesting", vestingController.updateUserVesting);

export const vestingRoute = vestingRouter;
