import { ServiceBase } from "./base";
import KycApplicationSchema, { KycApplicationModel } from "../models/kycApplication";
import { KycApplication } from "../data/kycApplication";

export class KycApplicationService extends ServiceBase<KycApplication, KycApplicationModel> {
  constructor() {
    super(KycApplicationSchema, "KycApplication");
  }
}

