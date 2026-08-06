import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { NonPaypalSubscription } from "../data/nonPaypalSubscription";

export interface NonPaypalSubscriptionModel
  extends IDocumentModel<NonPaypalSubscription>,
    NonPaypalSubscription {}

const nonPaypalSubscriptionSchemaOptions = {
  timestamps: { createdAt: "created", updatedAt: "modified" },
};

const nonPaypalSubscriptionSchema = new Schema(
  {
    orderId: String,
    paymentMethod: String,
    paymentStatus: String,
    transactionId: String,
    createdDate: Date,
    paymentDate: Date,
    nextPaymentDate: Date,
    notes: String, // Optional field for any additional notes
    email: String,
    address: String,
  },
  nonPaypalSubscriptionSchemaOptions
);

export default nonPaypalSubscriptionSchema;
