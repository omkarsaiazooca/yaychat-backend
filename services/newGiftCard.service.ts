import { NewGiftCard } from "../data/newGiftCard";
import NewGiftCardSchema, { NewGiftCardModel } from "../models/newGiftCard";
import { ServiceBase } from "./base";

export class NewGiftCardService extends ServiceBase<
  NewGiftCard,
  NewGiftCardModel
> {
  constructor() {
    super(NewGiftCardSchema, "NewGiftCards");
  }

  async updateAllGiftCard() {
    try {
      let getAllGiftCards = await this.find({});
      for (let index = 0; index < getAllGiftCards.length; index++) {
        const element = getAllGiftCards[index];
        let updateGiftCard = await this.updatePart(
          {
            voucher: element.voucher,
          },
          {
            $set: {
              paymentMethodUsed: "Asset Wallet",
            },
          }
        );
        console.log(updateGiftCard);
      }
    } catch (err) {
      console.log("Error in updating all gift cards", err);
    }
  }
}
