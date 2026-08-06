import { GiftCard } from "../data/giftCard";
import GiftCardSchema, { GiftCardModel } from "../models/giftCard";
import { ServiceBase } from "./base";

export class GiftCardService extends ServiceBase<GiftCard, GiftCardModel> {
  constructor() {
    super(GiftCardSchema, "Giftcards");
  }
}
