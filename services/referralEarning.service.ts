import { referralEarning } from "../data/referralEarning";
import referralEarningSchema, {
  ReferralEarningModel,
} from "../models/referralEarning";
import { ServiceBase } from "./base";
import { UserService } from "./user.service";

const userService = new UserService();

export class ReferralEarningService extends ServiceBase<
  referralEarning,
  ReferralEarningModel
> {
  constructor() {
    super(referralEarningSchema, "ReferralEarning");
  }

  /**
   * Validates a referral code against the user database
   * @param referralCode - The referral code to validate
   * @returns Promise with validation result
   */
  async validateReferralCode(referralCode: string): Promise<{
    isValid: boolean;
    referrer?: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
    };
    error?: string;
  }> {
    try {
      if (!referralCode || referralCode.trim() === "") {
        return {
          isValid: false,
          error: "Referral code is required"
        };
      }

      const trimmedCode = referralCode.trim();

      // Find the user who owns this referral code
      const referrer = await userService.findOne({ referralCode: trimmedCode });

      if (!referrer) {
        return {
          isValid: false,
          error: "Invalid referral code"
        };
      }

      return {
        isValid: true,
        referrer: {
          id: referrer._id.toString(),
          email: referrer.email,
          firstName: referrer.firstName || "",
          lastName: referrer.lastName || ""
        }
      };
    } catch (error) {
      console.error("Error validating referral code:", error);
      return {
        isValid: false,
        error: "Internal server error during validation"
      };
    }
  }
}



