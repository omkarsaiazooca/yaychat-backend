import { Affiliate } from "../data/affiliate";
export async function calculateLevelByReferralCode(
  affiliates: Affiliate[],
  referralCode: any
) {
  let affiliate = findAffiliateByReferralCode(
    affiliates,
    referralCode
  ) as Affiliate;

  if (!affiliate) {
    return { level: -1, user: affiliate as Affiliate };
  }

  let level = 1;
  const originalReferralCode = referralCode;
  console.log("level before", level);
  while (affiliate?.userData?.referralCode) {
    console.log("level in while", level);

    const sponsorReferralCode = String(affiliate.userData.referralCode);
    if (sponsorReferralCode === originalReferralCode) {
      level = level + (affiliate?.level ?? 1);
      break; // Avoid infinite loop by checking if the current user's referral code matches the original referral code
    }
    affiliate = findAffiliateByReferralCode(affiliates, sponsorReferralCode);
    level++;
  }
  console.log("level after", level);

  return { level, user: affiliate as Affiliate };
}

function findAffiliateByReferralCode(
  affiliates: Affiliate[],
  referralCode: any
) {
  let user: Affiliate = affiliates.find(
    (affiliate: Affiliate) => affiliate.userData?.referralCode === referralCode
  ) as Affiliate;
  return user;
}
