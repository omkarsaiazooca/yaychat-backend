import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import {Staking} from "../data/staking";

export interface StakingModel extends IDocumentModel<Staking>, Staking {
}

const stakingSchemaOptions = {
    timestamps: { createdAt: 'created', updatedAt: 'modified' }
};

var stakingSchema: Schema = new Schema({}, stakingSchemaOptions);

stakingSchema.add({
    stakingId: String,
    stakedAmount: Number,  //How much user is staking
    rewardAmount: Number,  //How much user is staking
    finalAmount: Number, // Final amount what user get
    coin: String,
    rewardCoin: String,
    email: String,
    percentage: Number, //Short - 6 Months 6%(0.06), Long - 12 Months 15%(0.15)
    startDate: Date,
    endDate: Date,
    isActive: Boolean,
    type: String, //Short or Long
    duration: String // 6 months or 12 months
});

export default stakingSchema;