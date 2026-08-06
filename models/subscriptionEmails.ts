import mongoose, { Document, Schema } from "mongoose";
import { SubscriptionEmails } from "../data/subscriptionEmails";
import { IDocumentModel } from "../data/base";
export interface SubscriptionEmailsModel
  extends IDocumentModel<SubscriptionEmails>,
    SubscriptionEmails {}

const subscriptionEmailsSchema: Schema = new Schema({
  email: { type: String, required: true },
  website: { type: String, required: true },
  date: { type: Date, default: Date.now },
});

export default subscriptionEmailsSchema;
