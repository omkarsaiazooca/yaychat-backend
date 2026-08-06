import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { Commission } from "../data/commission";

export interface CommissionModel extends IDocumentModel<Commission>, Commission {}

const commissionSchemaOptions = {
    timestamps: { createdAt: 'created', updatedAt: 'modified' }
};

var commissionSchema: Schema = new Schema({}, commissionSchemaOptions);

commissionSchema.add({
    orderId: String,
    mainCaptainBeeEmail: String,
    captainBeeEmail: String,
    honeyBeeEmail: String,
    commissionPercentage: Number, //15% or 20% or 25% or 30% or 35% or 40% or 45%
    finalCommissionAmountInUSD: Number,  // orderAmount * commissionPercentage
    finalCommissionAmountInINEX: Number,  // orderAmount * commissionPercentage
    orderAmount: Number,
    orderInCurrency: String,
    orderOutCurrency: String,
    orderType: String
});

export default commissionSchema;
