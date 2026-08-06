import { Affiliate } from "../data/affiliate";
import { User } from "../data/user";
import { AffilateService } from "../services/affiliate.service";
import { UserService } from "../services/user.service";

let uservice: UserService = new UserService();
let affilateService: AffilateService = new AffilateService();

export async function checkUserType0(email: string) {
  try {
    email = String(email).toLowerCase();
    let checkAffiliateData = (await affilateService.findOne({
      Email: email,
    })) as Affiliate;

    let user = (await uservice.findOne({
      email: email,
    })) as User;

    if (checkAffiliateData) {
      return "CaptainBee";
    } else if (
      user &&
      typeof user.referralCodeUsed === "string" &&
      user.referralCodeUsed.length > 0
    ) {
      return "HoneyBee";
    } else if (user) {
      return "Indexx Exchange";
    } else {
      return `NoUserFound`;
    }
  } catch (err: any) {
    console.error("Error in checking user type: ", err.message);
    return err.message; // Returning the error message for debugging
  }
}

export async function checkUserType(email: string) {
  try {
    const normalizedEmail = normalizeEmail(email);

    // Fetch both the affiliate data and user data in parallel
    const [affiliateData, user] = await Promise.all([
      affilateService.findOne({ Email: normalizedEmail }),
      uservice.findOne({ email: normalizedEmail })
    ]);

    if (affiliateData) {
      return "CaptainBee";
    }

    if (user) {
      return user.referralCodeUsed && user.referralCodeUsed.length > 0
        ? "HoneyBee"
        : "Indexx Exchange";
    }

    return "NoUserFound";
  } catch (err: any) {
    console.error("Error in checking user type: ", err.message);
    return `Error: ${err.message}`; // Include error in the response for better debugging
  }
}

// Helper to normalize email strings
function normalizeEmail(email: string) {
  return String(email).toLowerCase().trim();
}


export async function checkUserTypeByUsername(username: string) {
  try {
    let checkAffiliateData = (await affilateService.findOne({
      Username: username,
    })) as Affiliate;
    let user = (await uservice.findOne({
      username: username,
    })) as User;
    if (checkAffiliateData) {
      return "CaptainBee";
    } else if (
      user &&
      typeof user.referralCodeUsed === "string" &&
      user.referralCodeUsed.length > 0
    ) {
      return "HoneyBee";
    } else if (user) {
      return "Indexx Exchange";
    } else {
      return `NoUserFound`;
    }
  } catch (err: any) {
    console.log("Error in checking user type");
    return "";
  }
}
