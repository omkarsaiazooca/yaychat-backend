import { ServiceBase } from "./base";
import AffiliateSchema, { AffiliateModel } from "../models/affiliate";
import { Affiliate } from "../data/affiliate";

export class TempAffilateService extends ServiceBase<Affiliate, AffiliateModel> {
    constructor() {
        super(AffiliateSchema, "TempAffiliateUsers");
    }

}