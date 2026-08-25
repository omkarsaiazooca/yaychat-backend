import { ServiceBase } from "./base";
import pushDeviceSchema, { PushDeviceModel } from "../models/pushDevice";
import { DevicePlatform, PushDevice } from "../data/yaysNotifications";

export class PushDeviceService extends ServiceBase<PushDevice, PushDeviceModel> {
  constructor() {
    super(pushDeviceSchema, "YaysPushDevice");
  }

  /**
   * Register or refresh one install's token.
   *
   * Two collisions have to be handled: the same install re-registering (upsert
   * on `deviceId`), and the same *token* arriving for a different account —
   * which happens on a shared device after a sign-out/sign-in. The second
   * account's registration must take the token away from the first, or the
   * previous user keeps receiving the new user's messages.
   */
  async register(input: {
    userLower: string;
    deviceId: string;
    platform: DevicePlatform;
    token: string;
    appVersion?: string;
    osVersion?: string;
    model?: string;
  }): Promise<PushDevice> {
    await this.repo.deleteMany({
      token: input.token,
      userLower: { $ne: input.userLower },
    });

    return this.upsertOneAndGet(
      { userLower: input.userLower, deviceId: input.deviceId },
      {
        $set: {
          platform: input.platform,
          token: input.token,
          appVersion: input.appVersion ?? null,
          osVersion: input.osVersion ?? null,
          model: input.model ?? null,
          disabledAt: null,
          disabledReason: null,
          lastSeenAt: new Date(),
        },
        $setOnInsert: { userLower: input.userLower, deviceId: input.deviceId },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
  }

  /** Devices eligible to receive a push right now. */
  async activeFor(userLower: string): Promise<PushDevice[]> {
    return this.find({ userLower, disabledAt: null });
  }

  async activeForMany(userLowers: string[]): Promise<PushDevice[]> {
    if (!userLowers.length) {
      return [];
    }
    return this.find({ userLower: { $in: userLowers }, disabledAt: null });
  }

  async list(userLower: string): Promise<PushDevice[]> {
    return this.find({ userLower });
  }

  /** Called when the transport reports a token is gone. Kept, not deleted. */
  async disable(userLower: string, deviceId: string, reason: string): Promise<void> {
    await this.updatePart(
      { userLower, deviceId },
      { $set: { disabledAt: new Date(), disabledReason: reason } }
    );
  }

  /** Sign-out on one device: stop pushing to it without touching the others. */
  async unregister(userLower: string, deviceId: string): Promise<void> {
    await this.deleteOne({ userLower, deviceId });
  }

  async countActive(): Promise<number> {
    return this.findCount({ disabledAt: null });
  }
}
