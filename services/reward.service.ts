import { Reward } from "../data/reward";
import rewardSchema, { RewardModel } from "../models/reward";
import { ServiceBase } from "./base";

export class RewardService extends ServiceBase<Reward, RewardModel> {
    constructor() {
        super(rewardSchema, "Reward");
    }

    async createRewardForOrder1() {
        return await this.create({
            userId: "63495a547aa72680b1562302",
            email: "sunkuomkarsai@gmail.com",
            referralCode: "Reward for order",
            totalRewards: 45,
            rewardCurrency: 'Indexx Exchange Token',
            rewardTokenBalanceInUSD: 4.5,
            rewardUpdatedOn: new Date(),
            rewardTokenPrice: 0.1,
            rewardCurrencySymbol: "INEX",
            rewardCurrencyDecimals: 18,
            rewardTokenAddress: ""
        });
    }
}