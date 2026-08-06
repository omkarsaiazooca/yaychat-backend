import { getPriceByName } from "../controllers/priceAPI";
import { AffilateService } from "../services/affiliate.service";
import { CommissionService } from "../services/commission.service";
import { CurrencyService } from "../services/currency.service";
import { UserService } from "../services/user.service";
import { Order } from "./order";

const affilateService: AffilateService = new AffilateService();
const commissionService: CommissionService = new CommissionService();
const uservice: UserService = new UserService();
const currencyService: CurrencyService = new CurrencyService();

// Define the interface for Rank
interface Rank {
  name: string;
  salesVolumeRange: string;
  compensationPercentage: string;
}

interface FamilyRankCondition {
  name: string;
  baseRank: string;
  additionalRanksRequired: { rank: string; count: number }[];
  compensationPercentage: string;
}

// Updated FamilyRankCondition with new compensation percentages
const FamilyRankConditions: FamilyRankCondition[] = [
  {
    name: "Diamond Rank",
    baseRank: "Platinum",
    additionalRanksRequired: [{ rank: "Copper", count: 5 }],
    compensationPercentage: "40%",
  },
  {
    name: "Pollinated Diamond Rank",
    baseRank: "Diamond",
    additionalRanksRequired: [{ rank: "Copper", count: 6 }],
    compensationPercentage: "40%",
  },
  {
    name: "Carpenter Rank",
    baseRank: "Diamond",
    additionalRanksRequired: [{ rank: "Diamond", count: 1 }],
    compensationPercentage: "40%",
  },
  {
    name: "Pollinated Carpenter Rank",
    baseRank: "Carpenter",
    additionalRanksRequired: [{ rank: "Copper", count: 6 }],
    compensationPercentage: "40%",
  },
  {
    name: "Wasp Rank",
    baseRank: "Diamond",
    additionalRanksRequired: [{ rank: "Diamond", count: 3 }],
    compensationPercentage: "40%",
  },
  {
    name: "Pollinated Wasp Rank",
    baseRank: "Wasp",
    additionalRanksRequired: [{ rank: "Copper", count: 6 }],
    compensationPercentage: "40%",
  },
  {
    name: "Hornet Rank",
    baseRank: "Diamond",
    additionalRanksRequired: [{ rank: "Diamond", count: 6 }],
    compensationPercentage: "40%",
  },
  {
    name: "Pollinated Hornet Rank",
    baseRank: "Hornet",
    additionalRanksRequired: [{ rank: "Pollinated Diamond", count: 6 }],
    compensationPercentage: "40%",
  },
  {
    name: "Royal Rank",
    baseRank: "Diamond",
    additionalRanksRequired: [{ rank: "Diamond", count: 10 }],
    compensationPercentage: "40%",
  },
  {
    name: "Pollinated Royal Rank",
    baseRank: "Royal",
    additionalRanksRequired: [{ rank: "Pollinated Diamond", count: 6 }],
    compensationPercentage: "40%",
  },
];

// Define constants for each rank
const Ranks: Rank[] = [
  { name: "Bronze", salesVolumeRange: "0-1500", compensationPercentage: "10%" },
  {
    name: "Copper",
    salesVolumeRange: "1800-3300",
    compensationPercentage: "15%",
  },
  {
    name: "Silver",
    salesVolumeRange: "3600-5100",
    compensationPercentage: "20%",
  },
  {
    name: "Electrum",
    salesVolumeRange: "5400-6900",
    compensationPercentage: "25%",
  },
  {
    name: "Golden",
    salesVolumeRange: "7200-8700",
    compensationPercentage: "30%",
  },
  {
    name: "Platinum",
    salesVolumeRange: "9000-10500",
    compensationPercentage: "35%",
  },
  {
    name: "Diamond",
    salesVolumeRange: "10800+",
    compensationPercentage: "40%",
  },
];

/*
----------------------------------------------------------------
| Level    | Sales Volumn        | Captain Bees | Compensation |
----------------------------------------------------------------
| Bronze   | $0 - $1,500         | 0- 5         | 10%          |
| Copper   | $1,800 - $3,300     | 6 - 11       | 15%          |
| Silver   | $3,600 - $5,100     | 12 - 17      | 20%          |
| Electrum | $5,400 - $6,900     | 18 - 23      | 25%          |
| Golden   | $7,200 - $8,700     | 24 - 29      | 30%          |
| Platinum | $9,000 - $10,500    | 30 - 35      | 35%          |
| Diamond  | $10,800+            | 36+          | 40%          |
----------------------------------------------------------------
*/

// Function to calculate rank and new commission percentage
export function calculateRankAndCommission(salesVolume: number): {
  rank: Rank | undefined;
  newCommissionPercentage: string;
  newCommissionPercentageNumber: number;
} {
  try {
    console.log("salesVolumeRange", salesVolume);
    const userRank = Ranks.find((rank) => {
      const [min, max] = rank.salesVolumeRange.split("-").map((val) => {
        // If the value has a '+' at the end, remove it and convert to Number
        return Number(val.replace("+", ""));
      });

      // If max is NaN, only check the minimum value
      if (isNaN(max)) {
        return salesVolume >= min;
      }
      return salesVolume >= min && salesVolume <= max;
    });
    console.log(userRank);
    if (userRank) {
      const newCommissionPercentageNumber = parseInt(
        userRank.compensationPercentage,
        10
      );
      return {
        rank: userRank,
        newCommissionPercentage: userRank.compensationPercentage,
        newCommissionPercentageNumber,
      };
    } else {
      return {
        rank: undefined,
        newCommissionPercentage: "0%",
        newCommissionPercentageNumber: 0,
      };
    }
  } catch (err) {
    console.log("err in calculateRankAndCommission", err);
    return {
      rank: undefined,
      newCommissionPercentage: "0%",
      newCommissionPercentageNumber: 0,
    };
  }
}

// Updated calculateFamilyRank function
export function calculateFamilyRank(
  userRank: Rank | undefined,
  teamMembersByRank: { [rankName: string]: number }
): {
  familyRank: FamilyRankCondition | undefined;
  compensation: string;
  compensationInNumber: number;
} {
  if (!userRank)
    return {
      familyRank: undefined,
      compensation: "0%",
      compensationInNumber: 0,
    };

  const eligibleFamilyRanks = FamilyRankConditions.filter(
    (condition) => condition.baseRank === userRank.name
  );

  for (let familyRank of eligibleFamilyRanks) {
    let isEligible = true;

    for (let requiredRank of familyRank.additionalRanksRequired) {
      const count = teamMembersByRank[requiredRank.rank] || 0;
      if (count < requiredRank.count) {
        isEligible = false;
        break;
      }
    }

    if (isEligible) {
      return {
        familyRank,
        compensation: familyRank.compensationPercentage,
        compensationInNumber: parseInt(familyRank.compensationPercentage, 10),
      };
    }
  }
  console.log("famliy rank is not calculate no errrro");
  return { familyRank: undefined, compensation: "0%", compensationInNumber: 0 };
}

export async function getAllTeamMemberRanks(captainEmails: string[]) {
  let ranksByCaptainEmail: { [email: string]: string } = {};
  let teamMembersByRank: { [rank: string]: number } = {
    Bronze: 0,
    Copper: 0,
    Silver: 0,
    Electrum: 0,
    Golden: 0,
    Platinum: 0,
    Diamond: 0,
  };

  try {
    for (let index = 0; index < captainEmails.length; index++) {
      const email = captainEmails[index];

      let getAffiliateUser = await affilateService.findOne({
        Email: email,
      });

      // Assuming getAffiliateUser has a salesVolume property called totalCaptainBeeVolume
      const userRankObj =
        calculateRankAndCommission(getAffiliateUser.totalCaptainBeeVolume ?? 0)
          .rank || Ranks[0]; // Default to "Bronze"
      const userRank = userRankObj.name;

      ranksByCaptainEmail[email] = userRank;

      // Increment count for the current rank
      teamMembersByRank[userRank] = (teamMembersByRank[userRank] || 0) + 1;
    }
    return teamMembersByRank;
  } catch (err) {
    console.log(err);
  }
}

export async function calculateAndUpdateCommissionForCaptains(
  order: Order,
  CaptainEmail: string,
  honeyBeeEmail: string,
  commissionPercentage: number = 2 // 2% commission for levels 2 to 6 and only for INEX orders, 0.1 % for other than INEX orders
) {
  try {
    console.log("calculating level 2");
    console.log(order, CaptainEmail, honeyBeeEmail);
    let currentEmail = CaptainEmail; // Starting from the CaptainEmail since it's Level 2
    let level = 2;

    const userDetails = await uservice.findOne({
      email: currentEmail,
    });

    let getUserDetails = await uservice.findOne({
      referralCode: userDetails.referralCodeUsed,
    });
    currentEmail = getUserDetails.email;
    console.log("current new eamil, currentEmail", currentEmail);
    while (currentEmail && level <= 6) {
      const userDetails = await uservice.findOne({
        email: currentEmail,
      });

      let getCaptainData = await affilateService.findOne({
        Email: currentEmail,
      });

      let checkEmailIsCaptainBee = await affilateService.findOne({
        Email: honeyBeeEmail,
      });
      console.log("checkEmailIsCaptainBee", checkEmailIsCaptainBee);

      if (order && order?.user?.email === honeyBeeEmail) {
        let currenctOrderCount = getCaptainData?.orderCount
          ? getCaptainData.orderCount
          : 0;
        let currentcaptainOrderCount = getCaptainData?.captainOrderCount
          ? getCaptainData?.captainOrderCount
          : 0;
        let currentTotalVolume = getCaptainData?.totalCaptainBeeVolume
          ? getCaptainData?.totalCaptainBeeVolume
          : 0;
        let currentHoneyBeeVolume = getCaptainData?.totalHoneyBeeVolume
          ? getCaptainData?.totalHoneyBeeVolume
          : 0;
        let currentTotalCommissionEarnedInUSD = getCaptainData
          ?.totalCommissionEarned.amountInUSD
          ? getCaptainData?.totalCommissionEarned.amountInUSD
          : 0;
        let currentTotalCommissionEarnedInINEX = getCaptainData
          ?.totalCommissionEarned.amountInINEX
          ? getCaptainData?.totalCommissionEarned.amountInINEX
          : 0;

        let currentTotalCommissionToBePaidInUSD = getCaptainData
          ?.totalCommissionToBePaid.amountInUSD
          ? getCaptainData?.totalCommissionToBePaid.amountInUSD
          : 0;
        let currentTotalCommissionToBePaidINEX = getCaptainData
          ?.totalCommissionToBePaid.amountInINEX
          ? getCaptainData?.totalCommissionToBePaid.amountInINEX
          : 0;

        let currentTotalHoneyBeeCommissionToBePaidInUSD = getCaptainData
          ?.totalHoneyBeeCommissionToBePaid.amountInUSD
          ? getCaptainData?.totalHoneyBeeCommissionToBePaid.amountInUSD
          : 0;
        let currentTotalHoneyBeeCommissionEarnedToBePaidINEX = getCaptainData
          ?.totalHoneyBeeCommissionToBePaid.amountInINEX
          ? getCaptainData?.totalHoneyBeeCommissionToBePaid.amountInINEX
          : 0;

        let currentTotalHoneyBeeCommissionEarnedInINEX = getCaptainData
          ?.totalHoneyBeeCommissionEarned.amountInINEX
          ? getCaptainData?.totalHoneyBeeCommissionEarned.amountInINEX
          : 0;

        let currentTotalHoneyBeeCommissionEarnedInUSD = getCaptainData
          ?.totalHoneyBeeCommissionEarned.amountInUSD
          ? getCaptainData?.totalHoneyBeeCommissionEarned.amountInUSD
          : 0;

        let commissionAmountInUSD = 0;
        let commissionAmountInINEX = 0;

        commissionAmountInUSD =
          (order.breakdown.inAmount * (commissionPercentage / 100)) / 2;
        commissionAmountInINEX = await calculateCommissionInINEX(
          order,
          commissionPercentage
        );
        //(order.breakdown.inAmount * (commissionPercentage / 100)) / 2;
        console.log("commissionAmountInUSD", commissionAmountInUSD);
        console.log("commissionAmountInINEX", commissionAmountInINEX);

        let checkEmailIsCaptainBee = await affilateService.findOne({
          Email: honeyBeeEmail,
        });
        console.log("checkEmailIsCaptainBee", checkEmailIsCaptainBee);

        // Initialize the update object
        let updateFields: Record<string, any> = {
          orderCount: checkEmailIsCaptainBee
            ? currenctOrderCount
            : currenctOrderCount + 1,
          captainOrderCount: checkEmailIsCaptainBee
            ? currentcaptainOrderCount + 1
            : currentcaptainOrderCount,
          totalHoneyBeeVolume: checkEmailIsCaptainBee
            ? currentHoneyBeeVolume
            : currentHoneyBeeVolume + order.breakdown.inAmount,
          totalCaptainBeeVolume: checkEmailIsCaptainBee
            ? currentTotalVolume + order.breakdown.inAmount
            : currentHoneyBeeVolume,
          commissionPercentage: getCaptainData?.commissionPercentage ?? 0,
          rank: getCaptainData?.rank ?? "Bronze",
        };

        // Conditional fields based on checkEmailIsCaptainBee
        if (checkEmailIsCaptainBee) {
          updateFields = {
            ...updateFields,
            "totalCommissionEarned.amountInUSD":
              currentTotalCommissionEarnedInUSD + commissionAmountInUSD,
            "totalCommissionEarned.amountInINEX":
              currentTotalCommissionEarnedInINEX + commissionAmountInINEX,
            "totalCommissionToBePaid.amountInUSD":
              currentTotalCommissionToBePaidInUSD + commissionAmountInUSD,
            "totalCommissionToBePaid.amountInINEX":
              currentTotalCommissionToBePaidINEX + commissionAmountInINEX,
          };
        } else {
          updateFields = {
            ...updateFields,
            "totalHoneyBeeCommissionEarned.amountInUSD":
              currentTotalHoneyBeeCommissionToBePaidInUSD +
              commissionAmountInUSD,
            "totalHoneyBeeCommissionEarned.amountInINEX":
              currentTotalHoneyBeeCommissionEarnedInINEX +
              commissionAmountInINEX,
            "totalHoneyBeeCommissionToBePaid.amountInUSD":
              currentTotalHoneyBeeCommissionEarnedInUSD + commissionAmountInUSD,
            "totalHoneyBeeCommissionToBePaid.amountInINEX":
              currentTotalHoneyBeeCommissionEarnedToBePaidINEX +
              commissionAmountInINEX,
          };
        }

        // Perform the update
        let updateCaptainData = await affilateService.updatePart(
          { Email: currentEmail },
          { $set: updateFields }
        );

        // let updateCaptainData = await affilateService.updatePart(
        //   {
        //     Email: currentEmail,
        //   },
        //   {
        //     $set: {
        //       orderCount: checkEmailIsCaptainBee
        //         ? currenctOrderCount
        //         : currenctOrderCount + 1,
        //       captainOrderCount: checkEmailIsCaptainBee
        //         ? currentcaptainOrderCount + 1
        //         : currentcaptainOrderCount,
        //       totalHoneyBeeVolume: checkEmailIsCaptainBee
        //         ? currentHoneyBeeVolume
        //         : currentHoneyBeeVolume + order.breakdown.inAmount,
        //       totalCaptainBeeVolume: checkEmailIsCaptainBee
        //         ? currentTotalVolume + order.breakdown.inAmount
        //         : currentHoneyBeeVolume,
        //       "totalCommissionEarned.amountInUSD":
        //         currentTotalCommissionEarnedInUSD + commissionAmountInUSD,
        //       "totalCommissionEarned.amountInINEX":
        //         currentTotalCommissionEarnedInINEX + commissionAmountInINEX,
        //       "totalCommissionToBePaid.amountInUSD":
        //         currentTotalCommissionToBePaidInUSD + commissionAmountInUSD,
        //       "totalCommissionToBePaid.amountInINEX":
        //         currentTotalCommissionEarnedToBePaidINEX +
        //         commissionAmountInINEX,
        //         "totalHoneyBeeCommissionEarned.amountInUSD" : currentTotalHoneyBeeCommissionToBePaidInUSD + commissionAmountInUSD,
        //         "totalHoneyBeeCommissionEarned.amountInINEX" : currentTotalHoneyBeeCommissionEarnedInINEX + commissionAmountInINEX,
        //         "totalHoneyBeeCommissionToBePaid.amountInUSD" : currentTotalHoneyBeeCommissionEarnedInUSD + commissionAmountInUSD,
        //         "totalHoneyBeeCommissionToBePaid.amountInINEX" : currentTotalHoneyBeeCommissionEarnedToBePaidINEX + commissionAmountInINEX,
        //       commissionPercentage: getCaptainData?.commissionPercentage,
        //       rank: getCaptainData?.rank,
        //     },
        //   }
        // );

        // Create the commission record
        const createCommissionStucture = {
          orderId: order.orderId,
          mainCaptainBeeEmail: currentEmail,
          captainBeeEmail: checkEmailIsCaptainBee ? honeyBeeEmail : "",
          honeyBeeEmail: checkEmailIsCaptainBee ? "" : honeyBeeEmail,
          commissionPercentage: commissionPercentage,
          finalCommissionAmountInUSD: commissionAmountInUSD,
          finalCommissionAmountInINEX: commissionAmountInINEX,
          orderAmount: order.breakdown.inAmount,
          orderInCurrency: order.breakdown.inCurrenyName,
          orderOutCurrency: order.breakdown.outCurrencyName,
          orderType: order.orderType,
          name: "",
          rank: "",
        };

        const createCommission = await commissionService.create(
          createCommissionStucture
        );

        // Move to the next level and set the current email to the referred email
        level++;
        // Check if the referralCodeUsed is falsy and if so, break out of the loop
        if (!userDetails?.referralCodeUsed) {
          console.log("No referralCodeUsed found. Exiting loop.");
          break; // This will break out of the while loop
        }
        let getUserDetails = await uservice.findOne({
          referralCode: userDetails.referralCodeUsed,
        });
        currentEmail = getUserDetails.email;

        console.log(
          "current email after getuserDetails",
          currentEmail,
          userDetails.referralCodeUsed
        );
      }
    }
    return;
  } catch (err) {
    console.log(err);
    return;
  }
}

export async function calculateCommissionInINEX(
  order: Order,
  commission: number
) {
  try {
    let latestBaseRate = await currencyService.findOne({
      code: "INEX",
    });
    let inexPrice = latestBaseRate.buyPrice;

    const commissionInINEX =
      (order.breakdown.inAmount * (commission / 100)) / 2;
    console.log("commissionInINEX", commissionInINEX);

    // Convert that commission into INEX
    const commissionAmountInINEX = commissionInINEX / inexPrice;

    console.log("commissionAmountInINEX", commissionAmountInINEX, inexPrice);
    return commissionAmountInINEX;
  } catch (error) {
    console.error("Error calculating commission in INEX:", error);
    // Handle the error appropriately
    return 0; // Or throw error, or return null, depending on your error handling strategy
  }
}
