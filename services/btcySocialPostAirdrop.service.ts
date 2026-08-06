import { ServiceBase } from "./base";
import btcySocialPostAirdropSchema, {
  BTCYSocialPostAirdropRegistrationModel,
} from "../models/btcySocialPostAirdrop";
import { BTCYSocialPostAirdropRegistration } from "../data/btcySocialPostAirdrop";

export class BTCYSocialPostAirdropService extends ServiceBase<
  BTCYSocialPostAirdropRegistration,
  BTCYSocialPostAirdropRegistrationModel
> {
  private indexSyncPromise: Promise<void> | null = null;

  constructor() {
    super(btcySocialPostAirdropSchema, "BTCYSocialPostAirdropRegistrations");
  }

  async ensureIndexesSynced(): Promise<void> {
    if (!this.indexSyncPromise) {
      this.indexSyncPromise = this.syncIndexesInternal().catch((err) => {
        this.indexSyncPromise = null;
        throw err;
      });
    }
    await this.indexSyncPromise;
  }

  private async syncIndexesInternal(): Promise<void> {
    const model = (this.repo as any)?._model;
    if (!model?.syncIndexes) {
      return;
    }
    await model.syncIndexes();
  }
}
