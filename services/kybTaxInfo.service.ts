import { ServiceBase } from "./base";
import KybTaxInfoSchema, { KybTaxInfoModel } from "../models/kybTaxInfo";
import { KybTaxInfo } from "../data/kybTaxInfo";

export class KybTaxInfoService extends ServiceBase<KybTaxInfo, KybTaxInfoModel> {
  constructor() {
    super(KybTaxInfoSchema, "KybTaxInfo");
  }
}






