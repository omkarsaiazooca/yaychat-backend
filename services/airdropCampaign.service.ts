import { AirdropCampaign } from "../data/airdropCampaign";
import AirdropCampaignSchema, {
  AirdropCampaignModel,
} from "../models/airdropCampaign";
import { ServiceBase } from "./base";

export class AirdropCampaignService extends ServiceBase<
  AirdropCampaign,
  AirdropCampaignModel
> {
  constructor() {
    super(AirdropCampaignSchema, "AirdropCampaigns");
  }

  findActive() {
    return this.findOne({ active: true });
  }
}
