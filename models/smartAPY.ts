import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { SmartApy } from "../data/smartAPY";

export interface SmartAPYModel extends IDocumentModel<SmartApy>, SmartApy {
}

const smartApySchemaOptions = {
    timestamps: { createdAt: 'created', updatedAt: 'modified' }
};

var smartApySchema: Schema = new Schema({}, smartApySchemaOptions);

smartApySchema.add({
    smartApyId: String,
    stakedAmount: Number,  //How much user is staking
    rewardAmount: Number,  //How much user is staking
    finalAmount: Number, // Final amount what user get
    coin: String,
    rewardCoin: String,
    email: String,
    percentage: Number, //6 Months 20%(0.20),12 Months 30%(0.30), 18 Months 40%(0.40)
    startDate: Date,
    endDate: Date,
    isActive: Boolean,
    type: String, //Short or Long
    duration: String // 6 months or 12 months or 18 months
});

export default smartApySchema;