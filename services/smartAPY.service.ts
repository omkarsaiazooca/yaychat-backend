import { SmartApy } from "../data/smartAPY";
import smartApySchema, { SmartAPYModel } from "../models/smartAPY";
import { ServiceBase } from "./base";

export class SmartAPYService extends ServiceBase<SmartApy, SmartAPYModel> {
  constructor() {
    super(smartApySchema, "SmartAPY");
  }
}
