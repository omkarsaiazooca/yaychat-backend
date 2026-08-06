import { ServiceBase } from "./base";
import KybComplianceSchema, { KybComplianceModel } from "../models/kybCompliance";
import { KybCompliance } from "../data/kybCompliance";

export class KybComplianceService extends ServiceBase<KybCompliance, KybComplianceModel> {
  constructor() {
    super(KybComplianceSchema, "KybCompliance");
  }
}






