import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { AirdropCampaign } from "../data/airdropCampaign";

export interface AirdropCampaignModel
  extends IDocumentModel<AirdropCampaign>,
    AirdropCampaign {}

export const AirdropCampaignSchema: Schema = new Schema();

AirdropCampaignSchema.add({
  name: { type: String, index: true },
  title: String,
  imageUrl: String,
  startDate: Date,
  endDate: Date,
  active: { type: Boolean, default: false },
  body: String,
  termsUrl: String,
  ctaText: String,
  ctaUrl: String,
  createdAt: Date,
  updatedAt: Date,
});

export default AirdropCampaignSchema;
