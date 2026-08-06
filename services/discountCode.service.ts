import { DiscountCode } from "../data/discountCode";
import DiscountCodeSchema, { DiscountCodeModel } from "../models/discountCode";
import { ServiceBase } from "./base";

export class DiscountCodeService extends ServiceBase<DiscountCode, DiscountCodeModel> {
  constructor() {
    super(DiscountCodeSchema, "DiscountCode");
  }
}
