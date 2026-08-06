import { ServiceBase } from "./base";
import kybApplicationSchema, { KybApplicationModel } from "../models/kybApplication";
import { KybApplication } from "../data/kybApplication";

export class KybApplicationService extends ServiceBase<KybApplication, KybApplicationModel> {
  constructor() {
    super(kybApplicationSchema, "KybApplication");
  }
}






