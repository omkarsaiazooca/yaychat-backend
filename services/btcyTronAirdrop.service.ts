import { BTCYTronAirdropUser } from "../data/btcyTronAirdrop";
import BTCYTronAirdropSchema, { BTCYTronAirdropModel } from "../models/btcyTronAirdrop";
import { ServiceBase } from "./base";

export class BTCYTronAirdropService extends ServiceBase<BTCYTronAirdropUser, BTCYTronAirdropModel> {
  constructor() {
    super(BTCYTronAirdropSchema, "BTCYTronAirdropUsers");
  }
}
