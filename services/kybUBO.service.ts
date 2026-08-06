import { ServiceBase } from "./base";
import KybUBOSchema, { KybUBOModel } from "../models/kybUBO";
import { KybUBO } from "../data/kybUBO";

export class KybUBOService extends ServiceBase<KybUBO, KybUBOModel> {
  constructor() {
    super(KybUBOSchema, "KybUBO");
  }
}






