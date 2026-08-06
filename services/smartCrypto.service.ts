import { SmartCrypto } from "../data/smartCrypto";
import SmartCryptoSchema, { SmartCryptoModel } from "../models/smartCrypto";
import { ServiceBase } from "./base";

export class SmartCryptoService extends ServiceBase<SmartCrypto, SmartCryptoModel> {
  constructor() {
    super(SmartCryptoSchema, "SmartCryptoPackages");
  }
}
