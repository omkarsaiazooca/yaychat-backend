import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { Reward } from "../data/reward";

export interface RewardModel extends IDocumentModel<Reward>, Reward {
}

const rewardSchemaOptions = {
    timestamps: { createdAt: 'created', updatedAt: 'modified' }
};

var rewardSchema: Schema = new Schema({}, rewardSchemaOptions);

rewardSchema.add({
    userId: String,
    email: String,
    firstName: { type: String, default: '' },
    lastName: { type: String, default: '' },
    referralCode: String,
    totalRewards: Number,
    rewardCurrency: String,
    rewardTokenBalanceInUSD: Number,
    rewardCurrencySymbol: String,
    rewardCurrencyDecimals: Number,
    rewardUpdatedOn: Date,
    rewardTokenPrice: Number,
    rewardTokenAddress: { type: String, default: '' },
});

export default rewardSchema;